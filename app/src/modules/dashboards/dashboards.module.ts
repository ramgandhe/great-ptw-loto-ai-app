import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { LoggingModule } from '../logging/logging.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardController } from './dashboard.controller';
import { DashboardJobsService } from './dashboard-jobs.service';
import { DashboardLogService } from './dashboard-log.service';
import { DashboardService } from './dashboard.service';
import { KpiService } from './kpi.service';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [LoggingModule, StorageModule],
  controllers: [DashboardController, ReportingController, AnalyticsController],
  providers: [
    DashboardCacheService,
    DashboardLogService,
    DashboardJobsService,
    DashboardService,
    KpiService,
    ReportingService,
    AnalyticsService,
  ],
  exports: [
    DashboardCacheService,
    DashboardLogService,
    DashboardService,
    KpiService,
    ReportingService,
    AnalyticsService,
  ],
})
export class DashboardsModule {}
