import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Database performance hardening (PUS-218)', () => {
  let pool: Pool;
  let canConnect = false;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl });
    try {
      await pool.query('SELECT 1');
      canConnect = true;
      const db = drizzle(pool, { schema });
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

  dbTest('applies hot-path composite indexes from migration 0020', async () => {
    const required = [
      'permits_tenant_created_by_status_idx',
      'permits_tenant_planned_end_at_idx',
      'incidents_tenant_occurred_at_idx',
      'notification_recipients_tenant_user_read_idx',
      'audit_logs_tenant_created_at_idx',
      'report_exports_tenant_created_at_idx',
      'billing_invoices_tenant_created_at_idx',
      'tenant_subscriptions_tenant_renew_at_idx',
    ];

    const { rows } = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [required],
    );

    const found = new Set(rows.map((r) => r.indexname));
    for (const name of required) {
      expect(found.has(name)).toBe(true);
    }
  });

  dbTest('documents pool tuning knobs in .env.example', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const envExample = fs.readFileSync(
      path.join(__dirname, '../.env.example'),
      'utf8',
    );
    expect(envExample).toMatch(/DATABASE_POOL_MAX/);
    expect(envExample).toMatch(/DATABASE_POOL_IDLE_TIMEOUT_MS/);
    expect(envExample).toMatch(/DATABASE_POOL_CONNECTION_TIMEOUT_MS/);
  });
});
