import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { ExecutionModule } from '../execution/execution.module';
import { IncidentCacheService } from './incident-cache.service';
import { IncidentJobsService } from './incident-jobs.service';
import { IncidentLogService } from './incident-log.service';
import { IncidentSeverityLifecycleService } from './incident-severity-lifecycle.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [LoggingModule, ExecutionModule],
  controllers: [IncidentsController],
  providers: [
    IncidentsService,
    IncidentSeverityLifecycleService,
    IncidentCacheService,
    IncidentLogService,
    IncidentJobsService,
  ],
  exports: [IncidentsService, IncidentCacheService, IncidentLogService],
})
export class IncidentsModule {}
