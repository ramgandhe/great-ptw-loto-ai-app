import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gte, lte } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { notificationRecipients, notifications, permits } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  NOTIFICATION_DELIVERY_RETRY_JOB,
  NOTIFICATION_PERMIT_EXPIRY_JOB,
  NOTIFICATION_SYSTEM_ACTOR_ID,
  NOTIFICATION_TASK_REMINDER_JOB,
} from './notifications.constants';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationLogService } from './notification-log.service';

/**
 * BullMQ scheduled jobs for delivery retries, task reminders, and FR-NOT-005 expiry.
 */
@Injectable()
export class NotificationJobsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: NotificationLogService,
    private readonly dispatchService: NotificationDispatchService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(NOTIFICATION_DELIVERY_RETRY_JOB, async () => {
      await this.processDeliveryRetries();
    });
    this.queueService.registerHandler(NOTIFICATION_TASK_REMINDER_JOB, async () => {
      await this.emitTaskReminders();
    });
    this.queueService.registerHandler(NOTIFICATION_PERMIT_EXPIRY_JOB, async () => {
      await this.emitPermitExpiryNotices();
    });

    const retryCron =
      this.configService.get<string>('notification.deliveryRetryCron') ?? '*/5 * * * *';
    const reminderCron =
      this.configService.get<string>('notification.taskReminderCron') ?? '0 7 * * *';
    const expiryCron =
      this.configService.get<string>('notification.permitExpiryCron') ?? '0 6 * * *';

    try {
      await this.queueService.getQueue().add(
        NOTIFICATION_DELIVERY_RETRY_JOB,
        {},
        { repeat: { pattern: retryCron }, jobId: 'notification-delivery-retry-schedule' },
      );
      await this.queueService.getQueue().add(
        NOTIFICATION_TASK_REMINDER_JOB,
        {},
        { repeat: { pattern: reminderCron }, jobId: 'notification-task-reminder-schedule' },
      );
      await this.queueService.getQueue().add(
        NOTIFICATION_PERMIT_EXPIRY_JOB,
        {},
        { repeat: { pattern: expiryCron }, jobId: 'notification-permit-expiry-schedule' },
      );
      this.logger.log(
        `Scheduled notification delivery-retry (${retryCron}), task-reminder (${reminderCron}), permit-expiry (${expiryCron}) jobs`,
      );
    } catch (error) {
      this.logger.warn('Could not schedule notification jobs');
      this.logger.debug(error);
    }
  }

  async processDeliveryRetries(): Promise<void> {
    const now = new Date();
    const failed = await this.db
      .select({
        id: notificationRecipients.id,
        tenantId: notificationRecipients.tenantId,
        notificationId: notificationRecipients.notificationId,
        userId: notificationRecipients.userId,
        channel: notificationRecipients.channel,
        retryCount: notificationRecipients.retryCount,
      })
      .from(notificationRecipients)
      .where(
        and(
          eq(notificationRecipients.deliveryStatus, 'failed'),
          lte(notificationRecipients.nextRetryAt, now),
        ),
      );

    const maxRetries = this.configService.get<number>('notification.maxDeliveryRetries') ?? 5;

    for (const recipient of failed) {
      if (recipient.retryCount >= maxRetries) {
        this.logService.logEvent({
          action: 'notification.delivery-retry-exhausted',
          notificationId: recipient.notificationId,
          recipientId: recipient.id,
          tenantId: recipient.tenantId,
          userId: recipient.userId,
          metadata: { retryCount: recipient.retryCount },
        });
        continue;
      }

      this.logService.logEvent({
        action: 'notification.delivery-retry',
        notificationId: recipient.notificationId,
        recipientId: recipient.id,
        tenantId: recipient.tenantId,
        userId: recipient.userId,
        metadata: {
          channel: recipient.channel,
          retryCount: recipient.retryCount,
        },
      });
    }

    if (failed.length > 0) {
      this.logger.log(`Delivery retries flagged for ${failed.length} recipient(s)`);
    }
  }

  async emitTaskReminders(): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingReminders = await this.db
      .select({
        id: notifications.id,
        tenantId: notifications.tenantId,
        title: notifications.title,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.category, 'reminder'),
          eq(notifications.eventType, 'task_reminder'),
          gte(notifications.createdAt, since),
        ),
      );

    for (const reminder of pendingReminders) {
      this.logService.logEvent({
        action: 'notification.task-reminder',
        notificationId: reminder.id,
        tenantId: reminder.tenantId,
        metadata: {
          title: reminder.title,
          entityType: reminder.entityType,
          entityId: reminder.entityId,
        },
      });
    }

    if (pendingReminders.length > 0) {
      this.logger.log(`Task reminders emitted for ${pendingReminders.length} notification(s)`);
    }
  }

  /** FR-NOT-005 — notify before permit expiry within configured horizon. */
  async emitPermitExpiryNotices(now = new Date()): Promise<number> {
    const horizonHours =
      this.configService.get<number>('notification.permitExpiryHorizonHours') ?? 48;
    const horizonEnd = new Date(now.getTime() + horizonHours * 60 * 60 * 1000);
    const dayKey = now.toISOString().slice(0, 10);

    const active = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.status, 'active'), lte(permits.plannedEndAt, horizonEnd)));

    let dispatched = 0;
    for (const permit of active) {
      if (!permit.plannedEndAt || permit.plannedEndAt.getTime() < now.getTime()) {
        continue;
      }
      // still within horizon and not yet expired
      if (permit.plannedEndAt.getTime() > horizonEnd.getTime()) {
        continue;
      }

      const recipientId = permit.submittedBy ?? permit.createdBy;
      if (!recipientId) {
        continue;
      }

      const result = await this.dispatchService.dispatch({
        tenantId: permit.tenantId,
        actorId: NOTIFICATION_SYSTEM_ACTOR_ID,
        requirementId: 'FR-NOT-005',
        title: 'Permit approaching expiry',
        body: `Permit ${permit.reference ?? permit.id} expires within ${horizonHours} hours.`,
        recipientUserIds: [recipientId],
        entityType: 'permit',
        entityId: permit.id,
        dedupeKey: `fr-not-005:${permit.id}:${dayKey}`,
        sourceModule: 'notifications',
        category: 'reminder',
        priority: 'high',
      });

      if (!result.suppressed && !result.deduplicated) {
        dispatched += 1;
      }
    }

    if (dispatched > 0) {
      this.logger.log(`FR-NOT-005 expiry notices dispatched: ${dispatched}`);
    }
    return dispatched;
  }
}
