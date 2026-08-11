import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permitExtensions, permits, revalidationHistory } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  classifyPermitValidity,
  hoursRemaining,
} from './permit-validity.service';
import {
  MDP_DAY_TRANSITION_VALIDITY_JOB,
  MDP_EXTENSION_EXPIRY_JOB,
  MDP_REVALIDATION_REMINDER_JOB,
} from './revalidation.constants';
import { RevalidationLogService } from './revalidation-log.service';
import { RevalidationNotificationService } from './revalidation-notification.service';

@Injectable()
export class RevalidationJobsService implements OnModuleInit {
  private readonly logger = new Logger(RevalidationJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: RevalidationLogService,
    private readonly notificationService: RevalidationNotificationService,
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

    let renewalDueCount = 0;
    let expiredCount = 0;

    for (const permit of candidates) {
      const validityState = classifyPermitValidity(permit.plannedEndAt, now);
      const remainingHours = hoursRemaining(permit.plannedEndAt, now);

      if (validityState === 'within_validity') {
        continue;
      }

      if (validityState === 'renewal_due') {
        renewalDueCount += 1;
        this.logService.logEvent({
          action: 'mdp.validity-renewal-due',
          permitId: permit.id,
          tenantId: permit.tenantId,
          metadata: {
            reference: permit.reference,
            plannedEndAt: permit.plannedEndAt?.toISOString(),
            hoursRemaining: remainingHours,
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
        });
        continue;
      }

      expiredCount += 1;

      await this.db
        .update(permits)
        .set({ status: 'expired', updatedBy: permit.submittedBy ?? permit.tenantId })
        .where(and(eq(permits.id, permit.id), eq(permits.tenantId, permit.tenantId)));

      await this.db.insert(revalidationHistory).values({
        tenantId: permit.tenantId,
        permitId: permit.id,
        eventType: 'validity_expired',
        actorId: permit.submittedBy ?? permit.tenantId,
        payload: {
          reference: permit.reference,
          plannedEndAt: permit.plannedEndAt?.toISOString(),
          previousStatus: permit.status,
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
      });
    }

    if (renewalDueCount > 0 || expiredCount > 0) {
      this.logger.log(
        `Day-transition validity: ${renewalDueCount} renewal due, ${expiredCount} expired`,
      );
    }
  }
}
