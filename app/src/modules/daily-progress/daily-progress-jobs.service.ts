import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { permits, revalidationHistory } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { CanonicalNotificationService } from '../notifications/canonical-notification.service';
import { MDP_AUDIT_ACTIONS } from '../revalidation/mdp-audit-events';
import { MDP_DAILY_REMINDER_JOB } from './daily-progress.constants';
import { DailyProgressLogService } from './daily-progress-log.service';
import { DaySecureService } from './day-secure.service';

/**
 * BullMQ daily reminder for active multi-day permits (Slice I2).
 * Emits actionable canonical notifications for late secure / reopen / secure due.
 */
@Injectable()
export class DailyProgressJobsService implements OnModuleInit {
  private readonly logger = new Logger(DailyProgressJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: DailyProgressLogService,
    private readonly daySecureService: DaySecureService,
    private readonly canonicalNotifications: CanonicalNotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(MDP_DAILY_REMINDER_JOB, async () => {
      await this.sendReminders();
    });

    const cron = this.configService.get<string>('mdp.dailyReminderCron') ?? '0 7 * * *';

    try {
      await this.queueService.getQueue().add(
        MDP_DAILY_REMINDER_JOB,
        {},
        { repeat: { pattern: cron }, jobId: 'mdp-daily-reminder-schedule' },
      );
      this.logger.log(`Scheduled MDP daily reminder job (${cron})`);
    } catch (error) {
      this.logger.warn('Could not schedule MDP daily reminder job');
      this.logger.debug(error);
    }
  }

  async sendReminders(): Promise<void> {
    const active = await this.db
      .select({
        id: permits.id,
        tenantId: permits.tenantId,
        reference: permits.reference,
        submittedBy: permits.submittedBy,
      })
      .from(permits)
      .where(and(eq(permits.status, 'active')));

    let notified = 0;

    for (const permit of active) {
      let cycle: Awaited<ReturnType<DaySecureService['resolveDayCycle']>>;
      try {
        cycle = await this.daySecureService.resolveDayCycle(permit.id, permit.tenantId);
      } catch {
        continue;
      }

      if (!cycle.isMultiDay || !cycle.currentOperationalDate) {
        continue;
      }

      const action =
        cycle.dayCycleState === 'late_secure_required'
          ? ('late_secure_required' as const)
          : cycle.dayCycleState === 'reopen_due'
            ? ('reopen_due' as const)
            : cycle.dayCycleState === 'secure_due'
              ? ('secure_due' as const)
              : null;

      if (!action) {
        continue;
      }

      const historyEvent =
        action === 'late_secure_required'
          ? 'late_secure_reminder'
          : action === 'reopen_due'
            ? 'reopen_due_reminder'
            : 'secure_due_reminder';

      const already = await this.hasReminderEvent(
        permit.id,
        historyEvent,
        cycle.currentOperationalDate,
      );
      if (already) {
        continue;
      }

      const actorId = permit.submittedBy ?? permit.tenantId;

      await this.db.insert(revalidationHistory).values({
        tenantId: permit.tenantId,
        permitId: permit.id,
        eventType: historyEvent,
        actorId,
        payload: {
          operationalDate: cycle.currentOperationalDate,
          dayCycleState: cycle.dayCycleState,
          reference: permit.reference,
        },
        createdBy: actorId,
      });

      await this.canonicalNotifications.fromMdpDayCycleReminder({
        tenantId: permit.tenantId,
        permitId: permit.id,
        actorId,
        reference: permit.reference,
        operationalDate: cycle.currentOperationalDate,
        action,
        recipientUserIds: permit.submittedBy ? [permit.submittedBy] : undefined,
      });

      this.logService.logEvent({
        action:
          action === 'late_secure_required'
            ? MDP_AUDIT_ACTIONS.lateSecureReminder
            : action === 'reopen_due'
              ? MDP_AUDIT_ACTIONS.reopenDueReminder
              : MDP_AUDIT_ACTIONS.secureDueReminder,
        permitId: permit.id,
        tenantId: permit.tenantId,
        metadata: {
          reference: permit.reference,
          operationalDate: cycle.currentOperationalDate,
          dayCycleState: cycle.dayCycleState,
        },
      });

      notified += 1;
    }

    if (notified > 0) {
      this.logger.log(`MDP day-cycle reminders emitted for ${notified} active permit(s)`);
    }
  }

  private async hasReminderEvent(
    permitId: string,
    eventType: 'secure_due_reminder' | 'reopen_due_reminder' | 'late_secure_reminder',
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
}
