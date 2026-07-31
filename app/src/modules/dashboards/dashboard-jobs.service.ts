import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, isNull, lt, or } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { kpiCache, reportExports } from '../../database/schema';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  DASHBOARD_ANALYTICS_SNAPSHOT_JOB,
  DASHBOARD_KPI_REFRESH_JOB,
  DASHBOARD_REPORT_GENERATE_JOB,
} from './dashboards.constants';
import { DashboardLogService } from './dashboard-log.service';

/**
 * BullMQ scheduled jobs for report generation, analytics snapshots and KPI refresh.
 * Actual aggregation/export work lands in BE-SP-07.02; this layer scans + logs.
 */
@Injectable()
export class DashboardJobsService implements OnModuleInit {
  private readonly logger = new Logger(DashboardJobsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly logService: DashboardLogService,
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
    const pending = await this.db
      .select({
        id: reportExports.id,
        tenantId: reportExports.tenantId,
        reportType: reportExports.reportType,
        format: reportExports.format,
        requestedBy: reportExports.requestedBy,
      })
      .from(reportExports)
      .where(eq(reportExports.status, 'pending'));

    for (const report of pending) {
      this.logService.logEvent({
        action: 'dashboard.report-generate',
        tenantId: report.tenantId,
        userId: report.requestedBy,
        reportId: report.id,
        metadata: { reportType: report.reportType, format: report.format },
      });
    }

    if (pending.length > 0) {
      this.logger.log(`Pending report exports flagged: ${pending.length}`);
    }
  }

  async captureAnalyticsSnapshots(): Promise<void> {
    const scopes = ['permits', 'incidents', 'lototo', 'simops', 'operational'] as const;
    for (const scope of scopes) {
      this.logService.logEvent({
        action: 'dashboard.analytics-snapshot',
        scope,
        metadata: { trigger: 'scheduled' },
      });
    }
    this.logger.log(`Analytics snapshot sweep emitted for ${scopes.length} scope(s)`);
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

    for (const row of expired) {
      this.logService.logEvent({
        action: 'dashboard.kpi-refresh',
        tenantId: row.tenantId,
        kpiKey: row.kpiKey,
        metadata: { periodLabel: row.periodLabel, kpiCacheId: row.id },
      });
    }

    if (expired.length > 0) {
      this.logger.log(`Expired KPI cache rows flagged: ${expired.length}`);
    }
  }
}
