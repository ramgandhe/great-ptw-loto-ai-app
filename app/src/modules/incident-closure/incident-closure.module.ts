import { Module } from '@nestjs/common';
import { IncidentsModule } from '../incidents/incidents.module';
import { InvestigationModule } from '../investigation/investigation.module';
import { LoggingModule } from '../logging/logging.module';
import { IncidentClosureCacheService } from './incident-closure-cache.service';
import { IncidentClosureController } from './incident-closure.controller';
import { IncidentClosureJobsService } from './incident-closure-jobs.service';
import { IncidentClosureLogService } from './incident-closure-log.service';
import { IncidentClosureService } from './incident-closure.service';

@Module({
  imports: [LoggingModule, IncidentsModule, InvestigationModule],
  controllers: [IncidentClosureController],
  providers: [
    IncidentClosureService,
    IncidentClosureCacheService,
    IncidentClosureLogService,
    IncidentClosureJobsService,
  ],
  exports: [IncidentClosureService, IncidentClosureCacheService],
})
export class IncidentClosureModule {}
