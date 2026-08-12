import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { Job } from 'bullmq';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  organisations,
  permitExtensions,
  permits,
  revalidationHistory,
} from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  classifyPermitValidity,
  hoursRemaining,
  operationalDateKey,
} from './permit-validity.service';
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

  async sendRevalidationReminders(): Promise<void> {
    const active = await this.db
      .select({ id: permits.id, tenantId: permits.tenantId, reference: permits.reference })
      .from(permits)
      .where(eq(permits.status, 'active'));

    for (const permit of active) {
      this.logService.logEvent({
        action: 'mdp.revalidation-reminder',
        permitId: permit.id,
        tenantId: permit.tenantId,
        metadata: { reference: permit.reference },
      });
    }

    if (active.length > 0) {
      this.logger.log(`Revalidation reminders for ${active.length} active permit(s)`);
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

  /** FR-MDP-009: validity check against approved date range at each day-transition. */
  async runDayTransitionValidityChecks(now = new Date()): Promise<void> {
    const candidates = await this.db
      .select({
        id: permits.id,
        tenantId: permits.tenantId,
        reference: permits.reference,
        status: permits.status,
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
      .select({ tenantId: organisations.tenantId, timezone: organisations.timezone })
      .from(organisations)
      .where(inArray(organisations.tenantId, tenantIds));

    const timezoneByTenant = new Map(
      orgRows.map((row) => [row.tenantId, row.timezone ?? 'UTC']),
    );

    let renewalDueCount = 0;
    let expiredCount = 0;

    for (const permit of candidates) {
      const timezone = timezoneByTenant.get(permit.tenantId) ?? 'UTC';
      const operationalDate = operationalDateKey(now, timezone);
      const validityState = classifyPermitValidity(permit.plannedEndAt, now);
      const remainingHours = hoursRemaining(permit.plannedEndAt, now);

      if (validityState === 'within_validity') {
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
        continue;
      }

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
        plannedEndAt: permit.plannedEndAt!.toISOString(),
        hoursRemaining: remainingHours,
        operationalDate,
      });
    }

    if (renewalDueCount > 0 || expiredCount > 0) {
      this.logger.log(
        `Day-transition validity: ${renewalDueCount} renewal due, ${expiredCount} expired`,
      );
    }
  }

  private async hasValidityEvent(
    permitId: string,
    eventType: 'renewal_due_notified' | 'validity_expired',
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
