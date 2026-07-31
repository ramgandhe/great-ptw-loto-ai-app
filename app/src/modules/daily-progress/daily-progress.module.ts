import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { DailyProgressCacheService } from './daily-progress-cache.service';
import { DailyProgressController } from './daily-progress.controller';
import { DailyProgressJobsService } from './daily-progress-jobs.service';
import { DailyProgressLogService } from './daily-progress-log.service';
import { DailyProgressService } from './daily-progress.service';

@Module({
  imports: [LoggingModule],
  controllers: [DailyProgressController],
  providers: [
    DailyProgressService,
    DailyProgressCacheService,
    DailyProgressLogService,
    DailyProgressJobsService,
  ],
  exports: [DailyProgressService, DailyProgressCacheService, DailyProgressLogService],
})
export class DailyProgressModule {}
