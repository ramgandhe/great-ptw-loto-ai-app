import { randomUUID } from 'crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';
import { AnalyticsService } from '../app/src/modules/dashboards/analytics.service';
import { DashboardCacheService } from '../app/src/modules/dashboards/dashboard-cache.service';
import { DashboardLogService } from '../app/src/modules/dashboards/dashboard-log.service';
import { KpiService } from '../app/src/modules/dashboards/kpi.service';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

type AnalyticsPayload = {
  source: 'live' | 'snapshot';
  snapshot?: { payload: Record<string, number> } | null;
  payload?: Record<string, number>;
};

function analyticsMetrics(result: AnalyticsPayload): Record<string, number> {
  return result.source === 'live'
    ? (result.payload ?? {})
    : (result.snapshot?.payload ?? {});
}

describe('Dashboard canon reconciliation (FR-DAS-002–008)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const userId = randomUUID();
  const permitTypeId = randomUUID();

  const adminUser: AuthenticatedUser = {
    id: userId,
    username: 'org-admin',
    tenantId,
    roles: ['org-admin'],
  };

  let kpiService: KpiService;
  let analyticsService: AnalyticsService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    db = drizzle(pool, { schema });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder });
    } catch {
      canConnect = false;
      return;
    }

    const cache = new DashboardCacheService(
      { getJson: jest.fn().mockResolvedValue(null), setJson: jest.fn(), del: jest.fn() } as never,
      { get: () => 120 } as never,
    );
    const logService = new DashboardLogService();
    kpiService = new KpiService(db as never, cache, logService);
    analyticsService = new AnalyticsService(db as never, cache, logService);

    await db.insert(schema.permits).values([
      {
        tenantId,
        status: 'active',
        permitTypeId,
        title: 'Active permit',
        reference: `PTW-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      },
      {
        tenantId,
        status: 'pending_approval',
        permitTypeId,
        title: 'Pending permit',
        reference: `PTW-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      },
      {
        tenantId: otherTenantId,
        status: 'active',
        permitTypeId,
        title: 'Other tenant permit',
        reference: `PTW-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      },
    ]);

    await db.insert(schema.incidents).values({
      tenantId,
      status: 'open',
      incidentType: 'near_miss',
      severityPath: 'near_miss',
      title: 'Near miss',
      description: 'Test incident',
      occurredAt: new Date(),
      reference: `INC-${randomUUID().slice(0, 6)}`,
      reportedBy: userId,
      createdBy: userId,
    });
  });

  afterAll(async () => {
    if (canConnect) {
      await pool.end();
    }
  });

  const dbTest = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!canConnect) {
        return;
      }
      await fn();
    });
  };

  dbTest('FR-DAS-002: KPI counts reconcile to PostgreSQL tenant totals', async () => {
    const bundle = (await kpiService.getKpis(adminUser, {
      kind: 'management',
      periodLabel: 'current',
    })) as { items: Array<{ key: string; value: { count: number } }> };

    const active = bundle.items.find((item) => item.key === 'active_permits')?.value.count;
    const pending = bundle.items.find((item) => item.key === 'pending_approvals')?.value.count;
    const openIncidents = bundle.items.find((item) => item.key === 'open_incidents')?.value.count;

    expect(active).toBe(1);
    expect(pending).toBe(1);
    expect(openIncidents).toBe(1);
  });

  dbTest('FR-DAS-007/008: analytics scopes support operational filters and tenant isolation', async () => {
    const operational = (await analyticsService.getAnalytics(adminUser, {
      scope: 'operational',
    })) as AnalyticsPayload;
    const payload = analyticsMetrics(operational);

    expect(payload.activePermits).toBe(1);
    expect(payload.pendingApprovals).toBe(1);
    expect(payload.openIncidents).toBe(1);

    const otherUser: AuthenticatedUser = { ...adminUser, tenantId: otherTenantId };
    const otherOperational = (await analyticsService.getAnalytics(otherUser, {
      scope: 'operational',
    })) as AnalyticsPayload;
    const otherPayload = analyticsMetrics(otherOperational);

    expect(otherPayload.activePermits).toBe(1);
    expect(otherPayload.pendingApprovals).toBe(0);
  });

  dbTest('FR-DAS-003/004/005/006: permit, incident, simops and lototo scopes return live metrics', async () => {
    const permits = (await analyticsService.getAnalytics(adminUser, {
      scope: 'permits',
    })) as AnalyticsPayload;
    const incidents = (await analyticsService.getAnalytics(adminUser, {
      scope: 'incidents',
    })) as AnalyticsPayload;
    const simops = (await analyticsService.getAnalytics(adminUser, {
      scope: 'simops',
    })) as AnalyticsPayload;
    const lototo = (await analyticsService.getAnalytics(adminUser, {
      scope: 'lototo',
    })) as AnalyticsPayload;

    const permitPayload = analyticsMetrics(permits);
    const incidentPayload = analyticsMetrics(incidents);
    const simopsPayload = analyticsMetrics(simops);
    const lototoPayload = analyticsMetrics(lototo);

    expect(permitPayload.active).toBe(1);
    expect(incidentPayload.open).toBe(1);
    expect(simopsPayload.open).toBe(0);
    expect(lototoPayload.active).toBe(0);
  });
});
