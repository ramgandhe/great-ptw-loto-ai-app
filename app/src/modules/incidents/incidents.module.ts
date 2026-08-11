import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { IncidentCacheService } from './incident-cache.service';
import { IncidentJobsService } from './incident-jobs.service';
import { IncidentLogService } from './incident-log.service';
import { IncidentSeverityLifecycleService } from './incident-severity-lifecycle.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [LoggingModule],
  controllers: [IncidentsController],
  providers: [
    IncidentsService,
    IncidentCacheService,
    IncidentLogService,
    IncidentJobsService,
    IncidentSeverityLifecycleService,
  ],
  exports: [
    IncidentsService,
    IncidentCacheService,
    IncidentLogService,
    IncidentSeverityLifecycleService,
  ],
})
export class IncidentsModule {}
