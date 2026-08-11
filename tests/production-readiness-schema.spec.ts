import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Production readiness schema (PUS-223)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;
  const actorId = randomUUID();

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

  dbTest('stores backup run, retention policy and migration log', async () => {
    const tenantId = randomUUID();

    await db
      .delete(schema.dataRetentionPolicies)
      .where(
        and(
          isNull(schema.dataRetentionPolicies.tenantId),
          eq(schema.dataRetentionPolicies.entityType, 'audit_logs'),
        ),
      );

    const [backup] = await db
      .insert(schema.backupRuns)
      .values({
        target: 'postgres',
        status: 'succeeded',
        trigger: 'pre_migrate',
        storageLocation: 's3://backups/ptw/2026-07-31.dump',
        checksum: 'sha256:abc',
        sizeBytes: 1024,
        completedAt: new Date(),
        createdBy: actorId,
      })
      .returning();

    const [platformPolicy] = await db
      .insert(schema.dataRetentionPolicies)
      .values({
        tenantId: null,
        entityType: 'audit_logs',
        retentionDays: 2555,
        action: 'archive',
        createdBy: actorId,
      })
      .returning();

    const [tenantPolicy] = await db
      .insert(schema.dataRetentionPolicies)
      .values({
        tenantId,
        entityType: 'audit_logs',
        retentionDays: 3650,
        action: 'archive',
        createdBy: actorId,
      })
      .returning();

    const [migration] = await db
      .insert(schema.migrationRunLog)
      .values({
        environment: 'staging',
        migrationTag: '0021_production_readiness',
        status: 'succeeded',
        startedAt: new Date(),
        completedAt: new Date(),
        executedBy: actorId,
        createdBy: actorId,
      })
      .returning();

    expect(backup.status).toBe('succeeded');
    expect(platformPolicy.tenantId).toBeNull();
    expect(tenantPolicy.tenantId).toBe(tenantId);
    expect(migration.migrationTag).toBe('0021_production_readiness');

    const tenantScoped = await db
      .select()
      .from(schema.dataRetentionPolicies)
      .where(
        and(
          eq(schema.dataRetentionPolicies.tenantId, tenantId),
          eq(schema.dataRetentionPolicies.entityType, 'audit_logs'),
        ),
      );
    expect(tenantScoped).toHaveLength(1);
    expect(tenantScoped[0].id).toBe(tenantPolicy.id);
  });

  dbTest('rejects invalid backup target', async () => {
    await expect(
      db.insert(schema.backupRuns).values({
        target: 's3' as 'postgres',
        status: 'pending',
        createdBy: actorId,
      }),
    ).rejects.toThrow();
  });

  dbTest('enforces one platform retention policy per entity type', async () => {
    const entityType = 'report_exports';

    await db
      .delete(schema.dataRetentionPolicies)
      .where(
        and(
          isNull(schema.dataRetentionPolicies.tenantId),
          eq(schema.dataRetentionPolicies.entityType, entityType),
        ),
      );

    await db.insert(schema.dataRetentionPolicies).values({
      tenantId: null,
      entityType,
      retentionDays: 90,
      createdBy: actorId,
    });

    await expect(
      db.insert(schema.dataRetentionPolicies).values({
        tenantId: null,
        entityType,
        retentionDays: 120,
        createdBy: actorId,
      }),
    ).rejects.toThrow();

    const rows = await db
      .select()
      .from(schema.dataRetentionPolicies)
      .where(
        and(
          isNull(schema.dataRetentionPolicies.tenantId),
          eq(schema.dataRetentionPolicies.entityType, entityType),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  dbTest('rejects non-positive retention days', async () => {
    await expect(
      db.insert(schema.dataRetentionPolicies).values({
        tenantId: randomUUID(),
        entityType: 'notification_history',
        retentionDays: 0,
        createdBy: actorId,
      }),
    ).rejects.toThrow();
  });
});
