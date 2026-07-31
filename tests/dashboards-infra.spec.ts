import { readFileSync } from 'fs';
import { join } from 'path';
import { DashboardCacheService } from '../app/src/modules/dashboards/dashboard-cache.service';
import { DashboardJobsService } from '../app/src/modules/dashboards/dashboard-jobs.service';
import { DashboardLogService } from '../app/src/modules/dashboards/dashboard-log.service';

const repoRoot = join(__dirname, '..');

describe('Dashboards infra services (PUS-210)', () => {
  it('DashboardCacheService builds tenant-scoped keys and invalidates', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const cache = new DashboardCacheService(
      { del } as never,
      { get: () => 120 } as never,
    );
    expect(cache.dashboardKey('t1', 'u1', 'personal')).toBe('dashboard:personal:t1:u1');
    expect(cache.kpiKey('t1', 'active_permits', 'current')).toBe(
      'dashboard:kpi:t1:active_permits:current',
    );
    expect(cache.analyticsKey('t1', 'permits')).toBe('dashboard:analytics:t1:permits');

    await cache.invalidateTenant('t1', 'u1', 'personal');
    expect(del).toHaveBeenCalledWith('dashboard:personal:t1:u1');
  });

  it('DashboardLogService emits a Loki-tagged structured event', () => {
    const log = new DashboardLogService();
    const spy = jest
      .spyOn((log as unknown as { logger: { log: (v: unknown) => void } }).logger, 'log')
      .mockImplementation(() => undefined);
    log.logEvent({ action: 'dashboard.report-generate', reportId: 'r1' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ loki: true, action: 'dashboard.report-generate' }),
    );
  });

  it('DashboardJobsService delegates pending reports to ReportingService', async () => {
    const reportingService = { processPendingReports: jest.fn().mockResolvedValue(1) };
    const jobs = new DashboardJobsService(
      { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) } as never,
      {} as never,
      { get: () => '*/10 * * * *' } as never,
      { logEvent: jest.fn() } as never,
      reportingService as never,
      {} as never,
      {} as never,
    );

    await jobs.processPendingReports();
    expect(reportingService.processPendingReports).toHaveBeenCalled();
  });

  it('DashboardJobsService captures analytics snapshots per tenant', async () => {
    const logService = { logEvent: jest.fn() };
    const analyticsService = {
      listTenantIdsWithActivity: jest.fn().mockResolvedValue(['t1']),
      captureSnapshotsForTenant: jest.fn().mockResolvedValue(5),
    };
    const jobs = new DashboardJobsService(
      {} as never,
      {} as never,
      { get: () => '0 1 * * *' } as never,
      logService as never,
      {} as never,
      analyticsService as never,
      {} as never,
    );

    await jobs.captureAnalyticsSnapshots();
    expect(analyticsService.captureSnapshotsForTenant).toHaveBeenCalledWith('t1');
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dashboard.analytics-snapshot', tenantId: 't1' }),
    );
  });

  it('DashboardJobsService refreshes expired KPI tenants', async () => {
    const expired = [
      { id: 'k1', tenantId: 't1', kpiKey: 'active_permits', periodLabel: 'current' },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(expired) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const kpiService = { refreshTenantKpis: jest.fn().mockResolvedValue(undefined) };
    const jobs = new DashboardJobsService(
      db as never,
      {} as never,
      { get: () => '*/15 * * * *' } as never,
      logService as never,
      {} as never,
      {} as never,
      kpiService as never,
    );

    await jobs.refreshExpiredKpis();
    expect(kpiService.refreshTenantKpis).toHaveBeenCalledWith('t1');
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dashboard.kpi-refresh', tenantId: 't1' }),
    );
  });

  it('.env.example and deployment docs cover dashboard infra knobs', () => {
    const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
    const deployment = readFileSync(join(repoRoot, 'docs/deployment.md'), 'utf8');
    expect(envExample).toMatch(/DASHBOARD_REPORT_GENERATE_CRON/);
    expect(envExample).toMatch(/DASHBOARD_ANALYTICS_SNAPSHOT_CRON/);
    expect(envExample).toMatch(/DASHBOARD_KPI_REFRESH_CRON/);
    expect(envExample).toMatch(/METABASE_URL/);
    expect(deployment).toMatch(/dashboard\.report-generate/);
    expect(deployment).toMatch(/DASHBOARD_REPORT_PREFIX/);
  });
});
