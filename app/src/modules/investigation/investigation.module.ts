import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { InvestigationCacheService } from './investigation-cache.service';
import {
  CorrectiveActionController,
  InvestigationController,
} from './investigation.controller';
import { InvestigationJobsService } from './investigation-jobs.service';
import { InvestigationLogService } from './investigation-log.service';
import { InvestigationService } from './investigation.service';

@Module({
  imports: [LoggingModule],
  controllers: [InvestigationController, CorrectiveActionController],
  providers: [
    InvestigationService,
    InvestigationCacheService,
    InvestigationLogService,
    InvestigationJobsService,
  ],
  exports: [InvestigationService, InvestigationCacheService, InvestigationLogService],
})
export class InvestigationModule {}
