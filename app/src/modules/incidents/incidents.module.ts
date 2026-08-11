import { Module } from '@nestjs/common';
import { LoggingModule } from '../logging/logging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IncidentCacheService } from './incident-cache.service';
import { IncidentJobsService } from './incident-jobs.service';
import { IncidentLogService } from './incident-log.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [LoggingModule, NotificationsModule],
  controllers: [IncidentsController],
  providers: [
    IncidentsService,
    IncidentCacheService,
    IncidentLogService,
    IncidentJobsService,
  ],
  exports: [IncidentsService, IncidentCacheService, IncidentLogService],
})
export class IncidentsModule {}
