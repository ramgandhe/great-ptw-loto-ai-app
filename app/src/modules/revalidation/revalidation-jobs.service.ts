import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { Job } from 'bullmq';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  organisations,
  permitExtensions,
  permitStatusHistory,
  permits,
  revalidationHistory,
} from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  classifyMaxValidity,
  classifyPermitValidity,
  hoursRemaining,
  operationalDateKey,
} from './permit-validity.service';
import { inclusiveOperationalDaySpan } from './multi-day-schedule-rules';
import { DEFAULT_MAX_MULTI_DAY_VALIDITY_DAYS } from './multi-day.types';
import { resolveMultiDayTenantSettings } from './multi-day-settings';
import {
  MDP_DAY_TRANSITION_VALIDITY_JOB,
  MDP_EXTENSION_EXPIRY_JOB,
  MDP_REVALIDATION_REMINDER_JOB,
  MDP_VALIDITY_NOTIFICATION_JOB,
} from './revalidation.constants';
import { RevalidationLogService } from './revalidation-log.service';
import { RevalidationNotificationService } from './revalidation-notification.service';
import type { ValidityNotificationPayload } from './revalidation-notification.service';
import { CanonicalNotificationService } from '../notifications/canonical-notification.service';

@Injectable()
export class RevalidationJobsService implements OnModuleInit {
  private readonly logger = new Logger(RevalidationJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: RevalidationLogService,
    private readonly notificationService: RevalidationNotificationService,
    private readonly canonicalNotificationService: CanonicalNotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(MDP_REVALIDATION_REMINDER_JOB, async () => {
      await this.sendRevalidationReminders();
    });
    this.queueService.registerHandler(MDP_EXTENSION_EXPIRY_JOB, async () => {
      await this.flagExpiringExtensions();
    });
    this.queueService.registerHandler(MDP_DAY_TRANSITION_VALIDITY_JOB, async () => {
      await this.runDayTransitionValidityChecks();
    });
    this.queueService.registerHandler(MDP_VALIDITY_NOTIFICATION_JOB, async (job) => {
      await this.processValidityNotification(job as Job<ValidityNotificationPayload>);
    });

    const reminderCron =
      this.configService.get<string>('mdp.revalidationReminderCron') ?? '0 6 * * *';
    const expiryCron = this.configService.get<string>('mdp.extensionExpiryCron') ?? '0 5 * * *';
    const validityCron =
      this.configService.get<string>('mdp.dayTransitionValidityCron') ?? '0 0 * * *';

    try {
      await this.queueService.getQueue().add(
        MDP_REVALIDATION_REMINDER_JOB,
        {},
        { repeat: { pattern: reminderCron }, jobId: 'mdp-revalidation-reminder-schedule' },
      );
      await this.queueService.getQueue().add(
        MDP_EXTENSION_EXPIRY_JOB,
        {},
        { repeat: { pattern: expiryCron }, jobId: 'mdp-extension-expiry-schedule' },
      );
      await this.queueService.getQueue().add(
        MDP_DAY_TRANSITION_VALIDITY_JOB,
        {},
        { repeat: { pattern: validityCron }, jobId: 'mdp-day-transition-validity-schedule' },
      );
      this.logger.log(
        `Scheduled MDP revalidation (${reminderCron}), extension expiry (${expiryCron}), and day-transition validity (${validityCron}) jobs`,
      );
    } catch (error) {
      this.logger.warn('Could not schedule MDP revalidation jobs');
      this.logger.debug(error);
    }
  }

  /**
   * Morning reopen reminder (Slice I2). Day-cycle secure/late-secure reminders
   * are owned by DailyProgressJobsService; this job focuses on reopen_due.
   */
  async sendRevalidationReminders(): Promise<void> {
    const active = await this.db
      .select({
        id: permits.id,
        tenantId: permits.tenantId,
        reference: permits.reference,
        submittedBy: permits.submittedBy,
        dailyRevalidationRequired: permits.dailyRevalidationRequired,
      })
      .from(permits)
      .where(eq(permits.status, 'active'));

    let notified = 0;
    for (const permit of active) {
      if (permit.dailyRevalidationRequired === false) {
        continue;
      }

      this.logService.logEvent({
        action: 'mdp.revalidation-reminder',
        permitId: permit.id,
        tenantId: permit.tenantId,
        metadata: { reference: permit.reference },
      });
      notified += 1;
    }

    if (notified > 0) {
      this.logger.log(`Revalidation reminders for ${notified} active permit(s)`);
    }
  }

  async flagExpiringExtensions(): Promise<void> {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pending = await this.db
      .select()
      .from(permitExtensions)
      .where(
        and(eq(permitExtensions.status, 'pending'), lt(permitExtensions.requestedEndAt, soon)),
      );

    for (const extension of pending) {
      this.logService.logEvent({
        action: 'mdp.extension-expiry-flag',
        permitId: extension.permitId,
        tenantId: extension.tenantId,
        metadata: { extensionId: extension.id, requestedEndAt: extension.requestedEndAt },
      });
    }
  }

  /** FR-MDP-009 / Slice I1: validity + tenant max check at each day-transition. */
  async runDayTransitionValidityChecks(now = new Date()): Promise<void> {
    const candidates = await this.db
      .select({
        id: permits.id,
        tenantId: permits.tenantId,
        reference: permits.reference,
        status: permits.status,
        plannedStartAt: permits.plannedStartAt,
        plannedEndAt: permits.plannedEndAt,
        submittedBy: permits.submittedBy,
      })
      .from(permits)
      .where(inArray(permits.status, ['active', 'suspended']));

    if (candidates.length === 0) {
      return;
    }

    const tenantIds = [...new Set(candidates.map((row) => row.tenantId))];
    const orgRows = await this.db
      .select({
        tenantId: organisations.tenantId,
        timezone: organisations.timezone,
        maxMultiDayValidityDays: organisations.maxMultiDayValidityDays,
      })
      .from(organisations)
      .where(inArray(organisations.tenantId, tenantIds));

    const orgByTenant = new Map(
      orgRows.map((row) => [
        row.tenantId,
        {
          timezone: row.timezone ?? 'UTC',
          maxDays: resolveMultiDayTenantSettings(row).maxMultiDayValidityDays,
        },
      ]),
    );

    let renewalDueCount = 0;
    let maxValidityCount = 0;
    let expiredCount = 0;

    for (const permit of candidates) {
      const org = orgByTenant.get(permit.tenantId) ?? {
        timezone: 'UTC',
        maxDays: DEFAULT_MAX_MULTI_DAY_VALIDITY_DAYS,
      };
      const timezone = org.timezone;
      const operationalDate = operationalDateKey(now, timezone);
      const validityState = classifyPermitValidity(permit.plannedEndAt, now);
      const remainingHours = hoursRemaining(permit.plannedEndAt, now);
      const maxState = classifyMaxValidity({
        plannedStartAt: permit.plannedStartAt,
        plannedEndAt: permit.plannedEndAt,
        now,
        timezone,
        maxMultiDayValidityDays: org.maxDays,
      });
      const elapsedDays = permit.plannedStartAt
        ? inclusiveOperationalDaySpan(
            operationalDateKey(permit.plannedStartAt, timezone),
            operationalDate,
          )
        : null;

      // C8: clearance is day-scoped — record once per operational day that clear does not carry.
      const expiredLogged = await this.hasValidityEvent(
        permit.id,
        'clear_day_expired',
        operationalDate,
      );
      if (!expiredLogged) {
        await this.db.insert(revalidationHistory).values({
          tenantId: permit.tenantId,
          permitId: permit.id,
          eventType: 'clear_day_expired',
          actorId: permit.submittedBy ?? permit.tenantId,
          payload: {
            operationalDate,
            timezone,
            note: 'Cleared-for-work does not survive into the next operational day',
          },
          createdBy: permit.submittedBy ?? permit.tenantId,
        });
        this.logService.logEvent({
          action: 'mdp.clear_day_expired',
          permitId: permit.id,
          tenantId: permit.tenantId,
          metadata: { operationalDate, timezone },
        });
      }

      if (validityState === 'expired') {
        const [updated] = await this.db
          .update(permits)
          .set({ status: 'expired', updatedBy: permit.submittedBy ?? permit.tenantId })
          .where(
            and(
              eq(permits.id, permit.id),
              eq(permits.tenantId, permit.tenantId),
              inArray(permits.status, ['active', 'suspended']),
            ),
          )
          .returning({ id: permits.id });

        if (!updated) {
          continue;
        }

        expiredCount += 1;

        await this.db.insert(revalidationHistory).values({
          tenantId: permit.tenantId,
          permitId: permit.id,
          eventType: 'validity_expired',
          actorId: permit.submittedBy ?? permit.tenantId,
          payload: {
            reference: permit.reference,
            plannedEndAt: permit.plannedEndAt?.toISOString(),
            previousStatus: permit.status,
            operationalDate,
            timezone,
          },
          createdBy: permit.submittedBy ?? permit.tenantId,
        });

        await this.db.insert(permitStatusHistory).values({
          permitId: permit.id,
          action: 'expired',
          fromStatus: permit.status,
          toStatus: 'expired',
          actorId: permit.submittedBy ?? permit.tenantId,
          metadata: { system: true, operationalDate },
          createdBy: permit.submittedBy ?? permit.tenantId,
        });

        this.logService.logEvent({
          action: 'mdp.validity-expired',
          permitId: permit.id,
          tenantId: permit.tenantId,
          metadata: {
            reference: permit.reference,
            plannedEndAt: permit.plannedEndAt?.toISOString(),
            previousStatus: permit.status,
            operationalDate,
          },
        });

        await this.notificationService.enqueueValidityNotification({
          permitId: permit.id,
          tenantId: permit.tenantId,
          reference: permit.reference,
          issuerId: permit.submittedBy,
          validityState: 'expired',
          plannedEndAt: permit.plannedEndAt?.toISOString() ?? null,
          hoursRemaining: remainingHours,
          operationalDate,
        });
        continue;
      }

      // I1: tenant max reached → renew (prefer over 48h notice when both apply).
      if (maxState === 'max_validity_due') {
        const alreadyNotified = await this.hasValidityEvent(
          permit.id,
          'max_validity_due_notified',
          operationalDate,
        );
        if (alreadyNotified) {
          continue;
        }

        maxValidityCount += 1;

        await this.db.insert(revalidationHistory).values({
          tenantId: permit.tenantId,
          permitId: permit.id,
          eventType: 'max_validity_due_notified',
          actorId: permit.submittedBy ?? permit.tenantId,
          payload: {
            reference: permit.reference,
            plannedStartAt: permit.plannedStartAt?.toISOString(),
            plannedEndAt: permit.plannedEndAt?.toISOString(),
            maxMultiDayValidityDays: org.maxDays,
            elapsedDays,
            operationalDate,
            timezone,
          },
          createdBy: permit.submittedBy ?? permit.tenantId,
        });

        this.logService.logEvent({
          action: 'mdp.max_validity_due',
          permitId: permit.id,
          tenantId: permit.tenantId,
          metadata: {
            reference: permit.reference,
            maxMultiDayValidityDays: org.maxDays,
            elapsedDays,
            operationalDate,
          },
        });

        await this.notificationService.enqueueValidityNotification({
          permitId: permit.id,
          tenantId: permit.tenantId,
          reference: permit.reference,
          issuerId: permit.submittedBy,
          validityState: 'max_validity',
          plannedEndAt: permit.plannedEndAt?.toISOString() ?? null,
          hoursRemaining: remainingHours,
          operationalDate,
          maxMultiDayValidityDays: org.maxDays,
          elapsedDays,
        });
        continue;
      }

      if (validityState === 'renewal_due') {
        const alreadyNotified = await this.hasValidityEvent(
          permit.id,
          'renewal_due_notified',
          operationalDate,
        );
        if (alreadyNotified) {
          continue;
        }

        renewalDueCount += 1;

        await this.db.insert(revalidationHistory).values({
          tenantId: permit.tenantId,
          permitId: permit.id,
          eventType: 'renewal_due_notified',
          actorId: permit.submittedBy ?? permit.tenantId,
          payload: {
            reference: permit.reference,
            plannedEndAt: permit.plannedEndAt?.toISOString(),
            hoursRemaining: remainingHours,
            operationalDate,
            timezone,
          },
          createdBy: permit.submittedBy ?? permit.tenantId,
        });

        this.logService.logEvent({
          action: 'mdp.validity-renewal-due',
          permitId: permit.id,
          tenantId: permit.tenantId,
          metadata: {
            reference: permit.reference,
            plannedEndAt: permit.plannedEndAt?.toISOString(),
            hoursRemaining: remainingHours,
            operationalDate,
          },
        });

        await this.notificationService.enqueueValidityNotification({
          permitId: permit.id,
          tenantId: permit.tenantId,
          reference: permit.reference,
          issuerId: permit.submittedBy,
          validityState: 'renewal_due',
          plannedEndAt: permit.plannedEndAt!.toISOString(),
          hoursRemaining: remainingHours,
          operationalDate,
        });
      }
    }

    if (renewalDueCount > 0 || maxValidityCount > 0 || expiredCount > 0) {
      this.logger.log(
        `Day-transition validity: ${renewalDueCount} renewal due, ${maxValidityCount} max validity, ${expiredCount} expired`,
      );
    }
  }

  private async hasValidityEvent(
    permitId: string,
    eventType:
      | 'renewal_due_notified'
      | 'max_validity_due_notified'
      | 'validity_expired'
      | 'clear_day_expired',
    operationalDate: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: revalidationHistory.id })
      .from(revalidationHistory)
      .where(
        and(
          eq(revalidationHistory.permitId, permitId),
          eq(revalidationHistory.eventType, eventType),
          sql`${revalidationHistory.payload}->>'operationalDate' = ${operationalDate}`,
        ),
      )
      .limit(1);

    return Boolean(row);
  }

  async processValidityNotification(job: Job<ValidityNotificationPayload>): Promise<void> {
    await this.canonicalNotificationService.fromValidityPayload(job.data);
  }
}
