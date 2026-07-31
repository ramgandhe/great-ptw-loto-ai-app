import { Module } from '@nestjs/common';
import { DailyProgressCacheService } from './daily-progress-cache.service';
import { DailyProgressJobsService } from './daily-progress-jobs.service';
import { DailyProgressLogService } from './daily-progress-log.service';

@Module({
  providers: [DailyProgressCacheService, DailyProgressLogService, DailyProgressJobsService],
  exports: [DailyProgressCacheService, DailyProgressLogService, DailyProgressJobsService],
})
export class DailyProgressModule {}
