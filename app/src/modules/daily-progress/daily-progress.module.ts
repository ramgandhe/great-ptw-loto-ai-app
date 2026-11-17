import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { LoggingModule } from '../logging/logging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DailyProgressCacheService } from './daily-progress-cache.service';
import { DailyProgressController } from './daily-progress.controller';
import { DailyProgressJobsService } from './daily-progress-jobs.service';
import { DailyProgressLogService } from './daily-progress-log.service';
import { DailyProgressService } from './daily-progress.service';
import { DaySecureService } from './day-secure.service';
import { MdpEvidenceService } from './mdp-evidence.service';
import { MorningBriefingService } from './morning-briefing.service';

@Module({
  imports: [LoggingModule, NotificationsModule, StorageModule],
  controllers: [DailyProgressController],
  providers: [
    DailyProgressService,
    DaySecureService,
    MdpEvidenceService,
    MorningBriefingService,
    DailyProgressCacheService,
    DailyProgressLogService,
    DailyProgressJobsService,
  ],
  exports: [
    DailyProgressService,
    DaySecureService,
    MdpEvidenceService,
    MorningBriefingService,
    DailyProgressCacheService,
    DailyProgressLogService,
  ],
})
export class DailyProgressModule {}
