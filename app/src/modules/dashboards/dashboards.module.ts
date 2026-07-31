import { Module } from '@nestjs/common';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardJobsService } from './dashboard-jobs.service';
import { DashboardLogService } from './dashboard-log.service';

/**
 * SP-07.02 INF: Redis dashboard/KPI cache, Loki metrics logging, BullMQ report/snapshot/KPI jobs.
 * Controllers and aggregation land in BE-SP-07.02 (PUS-206).
 */
@Module({
  providers: [DashboardCacheService, DashboardLogService, DashboardJobsService],
  exports: [DashboardCacheService, DashboardLogService],
})
export class DashboardsModule {}
