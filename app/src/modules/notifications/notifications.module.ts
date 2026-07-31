import { Module } from '@nestjs/common';
import { NotificationCacheService } from './notification-cache.service';
import { NotificationJobsService } from './notification-jobs.service';
import { NotificationLogService } from './notification-log.service';

/**
 * SP-07.01 INF: Redis cache, Loki delivery logging, BullMQ retry/reminder jobs.
 * Controllers and persistence orchestration land in BE-SP-07.01 (PUS-201).
 */
@Module({
  providers: [NotificationCacheService, NotificationLogService, NotificationJobsService],
  exports: [NotificationCacheService, NotificationLogService],
})
export class NotificationsModule {}
