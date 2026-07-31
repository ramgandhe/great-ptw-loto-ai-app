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

  it('DashboardJobsService flags pending report exports', async () => {
    const pending = [
      {
        id: 'r1',
        tenantId: 't1',
        reportType: 'permit_summary',
        format: 'pdf',
        requestedBy: 'u1',
      },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(pending) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new DashboardJobsService(
      db as never,
      {} as never,
      { get: () => '*/10 * * * *' } as never,
      logService as never,
    );

    await jobs.processPendingReports();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'dashboard.report-generate',
        reportId: 'r1',
      }),
    );
  });

  it('DashboardJobsService emits analytics snapshot sweep', async () => {
    const logService = { logEvent: jest.fn() };
    const jobs = new DashboardJobsService(
      { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) } as never,
      {} as never,
      { get: () => '0 1 * * *' } as never,
      logService as never,
    );

    await jobs.captureAnalyticsSnapshots();
    expect(logService.logEvent).toHaveBeenCalledTimes(5);
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dashboard.analytics-snapshot', scope: 'permits' }),
    );
  });

  it('DashboardJobsService flags expired KPI cache rows', async () => {
    const expired = [
      { id: 'k1', tenantId: 't1', kpiKey: 'active_permits', periodLabel: 'current' },
    ];
    const db = {
      select: () => ({ from: () => ({ where: () => Promise.resolve(expired) }) }),
    };
    const logService = { logEvent: jest.fn() };
    const jobs = new DashboardJobsService(
      db as never,
      {} as never,
      { get: () => '*/15 * * * *' } as never,
      logService as never,
    );

    await jobs.refreshExpiredKpis();
    expect(logService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dashboard.kpi-refresh', kpiKey: 'active_permits' }),
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
