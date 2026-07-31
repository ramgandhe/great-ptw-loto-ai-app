import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { IncidentCacheService } from './incident-cache.service';
import { IncidentJobsService } from './incident-jobs.service';
import { IncidentLogService } from './incident-log.service';

@Module({
  imports: [LoggingModule],
  providers: [IncidentCacheService, IncidentLogService, IncidentJobsService],
  exports: [IncidentCacheService, IncidentLogService],
})
export class IncidentsModule {}
