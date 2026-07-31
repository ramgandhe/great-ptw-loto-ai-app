import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { InvestigationCacheService } from './investigation-cache.service';
import { InvestigationJobsService } from './investigation-jobs.service';
import { InvestigationLogService } from './investigation-log.service';

@Module({
  imports: [LoggingModule],
  providers: [
    InvestigationCacheService,
    InvestigationLogService,
    InvestigationJobsService,
  ],
  exports: [InvestigationCacheService, InvestigationLogService],
})
export class InvestigationModule {}
