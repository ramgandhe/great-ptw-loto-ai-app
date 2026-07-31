import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { IncidentClosureCacheService } from './incident-closure-cache.service';
import { IncidentClosureJobsService } from './incident-closure-jobs.service';
import { IncidentClosureLogService } from './incident-closure-log.service';

@Module({
  imports: [LoggingModule],
  providers: [
    IncidentClosureCacheService,
    IncidentClosureLogService,
    IncidentClosureJobsService,
  ],
  exports: [IncidentClosureCacheService, IncidentClosureLogService],
})
export class IncidentClosureModule {}
