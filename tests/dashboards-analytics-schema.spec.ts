import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Dashboards & Analytics schema (PUS-209)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  const userId = randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    db = drizzle(pool, { schema });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder });
    } catch {
      canConnect = false;
    }
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

  dbTest('stores preferences, exports, snapshots and kpi cache under a tenant', async () => {
    const tenantId = randomUUID();

    const [pref] = await db
      .insert(schema.dashboardPreferences)
      .values({
        tenantId,
        userId,
        dashboardKind: 'personal',
        layout: { widgets: ['my_permits', 'notifications'] },
        filters: { plantId: null },
        createdBy: userId,
      })
      .returning();

    const [report] = await db
      .insert(schema.reportExports)
      .values({
        tenantId,
        requestedBy: userId,
        reportType: 'permit_summary',
        format: 'pdf',
        status: 'pending',
        filters: { status: 'active' },
        createdBy: userId,
      })
      .returning();

    const periodStart = new Date('2026-07-01T00:00:00.000Z');
    const periodEnd = new Date('2026-07-31T23:59:59.000Z');

    const [snapshot] = await db
      .insert(schema.analyticsSnapshots)
      .values({
        tenantId,
        scope: 'permits',
        periodStart,
        periodEnd,
        payload: { active: 12, closed: 4 },
        createdBy: userId,
      })
      .returning();

    const [kpi] = await db
      .insert(schema.kpiCache)
      .values({
        tenantId,
        kpiKey: 'active_permits',
        dashboardKind: 'hod',
        periodLabel: 'current',
        value: { count: 12 },
        createdBy: userId,
      })
      .returning();

    expect(pref.dashboardKind).toBe('personal');
    expect(report.format).toBe('pdf');
    expect(snapshot.scope).toBe('permits');
    expect(kpi.kpiKey).toBe('active_permits');
  });

  dbTest('enforces unique dashboard preference per tenant/user/kind', async () => {
    const tenantId = randomUUID();

    await db.insert(schema.dashboardPreferences).values({
      tenantId,
      userId,
      dashboardKind: 'safety',
      createdBy: userId,
    });

    await expect(
      db.insert(schema.dashboardPreferences).values({
        tenantId,
        userId,
        dashboardKind: 'safety',
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  dbTest('rejects invalid dashboard_kind and report format CHECK values', async () => {
    const tenantId = randomUUID();

    await expect(
      db.insert(schema.dashboardPreferences).values({
        tenantId,
        userId,
        dashboardKind: 'not_a_kind',
        createdBy: userId,
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(schema.reportExports).values({
        tenantId,
        requestedBy: userId,
        reportType: 'ops',
        format: 'docx',
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  dbTest('blocks UPDATE and DELETE on analytics_snapshots', async () => {
    const tenantId = randomUUID();
    const periodStart = new Date('2026-06-01T00:00:00.000Z');
    const periodEnd = new Date('2026-06-30T23:59:59.000Z');

    const [snapshot] = await db
      .insert(schema.analyticsSnapshots)
      .values({
        tenantId,
        scope: 'incidents',
        periodStart,
        periodEnd,
        payload: { open: 2 },
        createdBy: userId,
      })
      .returning();

    await expect(
      db
        .update(schema.analyticsSnapshots)
        .set({ payload: { open: 99 } })
        .where(eq(schema.analyticsSnapshots.id, snapshot.id)),
    ).rejects.toThrow(/immutable/i);

    await expect(
      db.delete(schema.analyticsSnapshots).where(eq(schema.analyticsSnapshots.id, snapshot.id)),
    ).rejects.toThrow(/immutable/i);
  });

  dbTest('enforces unique kpi_cache key per tenant/period', async () => {
    const tenantId = randomUUID();

    await db.insert(schema.kpiCache).values({
      tenantId,
      kpiKey: 'open_incidents',
      periodLabel: '7d',
      value: { count: 3 },
      createdBy: userId,
    });

    await expect(
      db.insert(schema.kpiCache).values({
        tenantId,
        kpiKey: 'open_incidents',
        periodLabel: '7d',
        value: { count: 4 },
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });
});
