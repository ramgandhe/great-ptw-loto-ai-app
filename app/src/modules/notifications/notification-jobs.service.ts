import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gte, lte } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { notificationRecipients, notifications } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  NOTIFICATION_DELIVERY_RETRY_JOB,
  NOTIFICATION_TASK_REMINDER_JOB,
} from './notifications.constants';
import { NotificationLogService } from './notification-log.service';

/**
 * BullMQ scheduled jobs for delivery retries and task reminders (SP-07.01 INF).
 * Actual channel delivery is owned by BE-SP-07.01; this layer scans metadata and logs.
 */
@Injectable()
export class NotificationJobsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: NotificationLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(NOTIFICATION_DELIVERY_RETRY_JOB, async () => {
      await this.processDeliveryRetries();
    });
    this.queueService.registerHandler(NOTIFICATION_TASK_REMINDER_JOB, async () => {
      await this.emitTaskReminders();
    });

    const retryCron =
      this.configService.get<string>('notification.deliveryRetryCron') ?? '*/5 * * * *';
    const reminderCron =
      this.configService.get<string>('notification.taskReminderCron') ?? '0 7 * * *';

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
      this.logger.log(
        `Scheduled notification delivery-retry (${retryCron}) and task-reminder (${reminderCron}) jobs`,
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

    for (const recipient of failed) {
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
}
