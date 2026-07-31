import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isNull, lt, or } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { kpiCache } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { AnalyticsService } from './analytics.service';
import {
  DASHBOARD_ANALYTICS_SNAPSHOT_JOB,
  DASHBOARD_KPI_REFRESH_JOB,
  DASHBOARD_REPORT_GENERATE_JOB,
} from './dashboards.constants';
import { DashboardLogService } from './dashboard-log.service';
import { KpiService } from './kpi.service';
import { ReportingService } from './reporting.service';

/**
 * BullMQ scheduled jobs for report generation, analytics snapshots and KPI refresh.
 */
@Injectable()
export class DashboardJobsService implements OnModuleInit {
  private readonly logger = new Logger(DashboardJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: DashboardLogService,
    private readonly reportingService: ReportingService,
    private readonly analyticsService: AnalyticsService,
    private readonly kpiService: KpiService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queueService.registerHandler(DASHBOARD_REPORT_GENERATE_JOB, async () => {
      await this.processPendingReports();
    });
    this.queueService.registerHandler(DASHBOARD_ANALYTICS_SNAPSHOT_JOB, async () => {
      await this.captureAnalyticsSnapshots();
    });
    this.queueService.registerHandler(DASHBOARD_KPI_REFRESH_JOB, async () => {
      await this.refreshExpiredKpis();
    });

    const reportCron =
      this.configService.get<string>('dashboard.reportGenerateCron') ?? '*/10 * * * *';
    const snapshotCron =
      this.configService.get<string>('dashboard.analyticsSnapshotCron') ?? '0 1 * * *';
    const kpiCron = this.configService.get<string>('dashboard.kpiRefreshCron') ?? '*/15 * * * *';

    try {
      await this.queueService.getQueue().add(
        DASHBOARD_REPORT_GENERATE_JOB,
        {},
        { repeat: { pattern: reportCron }, jobId: 'dashboard-report-generate-schedule' },
      );
      await this.queueService.getQueue().add(
        DASHBOARD_ANALYTICS_SNAPSHOT_JOB,
        {},
        { repeat: { pattern: snapshotCron }, jobId: 'dashboard-analytics-snapshot-schedule' },
      );
      await this.queueService.getQueue().add(
        DASHBOARD_KPI_REFRESH_JOB,
        {},
        { repeat: { pattern: kpiCron }, jobId: 'dashboard-kpi-refresh-schedule' },
      );
      this.logger.log(
        `Scheduled dashboard jobs: report (${reportCron}), snapshot (${snapshotCron}), kpi (${kpiCron})`,
      );
    } catch (error) {
      this.logger.warn('Could not schedule dashboard jobs');
      this.logger.debug(error);
    }
  }

  async processPendingReports(): Promise<void> {
    const processed = await this.reportingService.processPendingReports();
    if (processed > 0) {
      this.logger.log(`Pending report exports processed: ${processed}`);
    }
  }

  async captureAnalyticsSnapshots(): Promise<void> {
    const tenantIds = await this.analyticsService.listTenantIdsWithActivity();
    let written = 0;
    for (const tenantId of tenantIds) {
      written += await this.analyticsService.captureSnapshotsForTenant(tenantId);
      this.logService.logEvent({
        action: 'dashboard.analytics-snapshot',
        tenantId,
        metadata: { trigger: 'scheduled' },
      });
    }
    this.logger.log(
      `Analytics snapshot sweep: ${tenantIds.length} tenant(s), ${written} row(s) written`,
    );
  }

  async refreshExpiredKpis(): Promise<void> {
    const now = new Date();
    const expired = await this.db
      .select({
        id: kpiCache.id,
        tenantId: kpiCache.tenantId,
        kpiKey: kpiCache.kpiKey,
        periodLabel: kpiCache.periodLabel,
      })
      .from(kpiCache)
      .where(or(isNull(kpiCache.expiresAt), lt(kpiCache.expiresAt, now)));

    const tenantIds = [...new Set(expired.map((row) => row.tenantId))];
    for (const tenantId of tenantIds) {
      await this.kpiService.refreshTenantKpis(tenantId);
      this.logService.logEvent({
        action: 'dashboard.kpi-refresh',
        tenantId,
        metadata: { trigger: 'scheduled' },
      });
    }

    if (expired.length > 0) {
      this.logger.log(`Expired KPI cache refreshed for ${tenantIds.length} tenant(s)`);
    }
  }
}
