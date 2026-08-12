import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { CanonicalNotificationService } from './canonical-notification.service';
import { DeliveryService } from './delivery.service';
import { EscalationService } from './escalation.service';
import { NotificationCacheService } from './notification-cache.service';
import { NotificationJobsService } from './notification-jobs.service';
import { NotificationLogService } from './notification-log.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReminderService } from './reminder.service';

@Module({
  imports: [LoggingModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    CanonicalNotificationService,
    DeliveryService,
    ReminderService,
    EscalationService,
    NotificationCacheService,
    NotificationLogService,
    NotificationJobsService,
  ],
  exports: [
    NotificationsService,
    CanonicalNotificationService,
    DeliveryService,
    ReminderService,
    EscalationService,
    NotificationCacheService,
    NotificationLogService,
  ],
})
export class NotificationsModule {}
