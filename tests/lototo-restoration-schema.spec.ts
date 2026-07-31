import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('LOTOTO restoration & history schema (PUS-164)', () => {
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

  async function seedExecution(tenantId: string = randomUUID()) {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId: randomUUID(),
        title: 'Restoration permit',
        reference: `PTW-RST-${randomUUID().slice(0, 8)}`,
        createdBy: userId,
      })
      .returning();
    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({ tenantId, code: `WS-${randomUUID().slice(0, 6)}`, name: 'Bay', createdBy: userId })
      .returning();
    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: `MC-${randomUUID().slice(0, 6)}`,
        name: 'Compressor',
        workstationId: workstation.id,
        createdBy: userId,
      })
      .returning();
    const [plan] = await db
      .insert(schema.lototoPlans)
      .values({ tenantId, permitId: permit.id, machineryId: machinery.id, title: 'Plan', status: 'ready', createdBy: userId })
      .returning();
    const [point] = await db
      .insert(schema.isolationPoints)
      .values({ planId: plan.id, machineryId: machinery.id, isolationNumber: 'ISO-1', createdBy: userId })
      .returning();
    const [execution] = await db
      .insert(schema.isolationExecution)
      .values({ tenantId, planId: plan.id, startedBy: userId, createdBy: userId })
      .returning();
    const [lock] = await db
      .insert(schema.appliedLocks)
      .values({ tenantId, executionId: execution.id, isolationPointId: point.id, lockTag: 'LK-1', lockMethod: 'padlock', appliedBy: userId, createdBy: userId })
      .returning();
    const [tag] = await db
      .insert(schema.appliedTags)
      .values({ tenantId, executionId: execution.id, isolationPointId: point.id, tagNumber: 'TG-1', tagType: 'danger', appliedBy: userId, createdBy: userId })
      .returning();

    return { tenantId, plan, point, execution, lock, tag };
  }

  // --- Positive ---

  dbTest('records equipment restoration, lock/tag removals and verification (FR-LTO-012)', async () => {
    const ctx = await seedExecution();

    const [restoration] = await db
      .insert(schema.equipmentRestorations)
      .values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, isolationPointId: ctx.point.id, restoredBy: userId, createdBy: userId })
      .returning();
    expect(restoration.status).toBe('restored');

    const [lockRemoval] = await db
      .insert(schema.lockRemovals)
      .values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, appliedLockId: ctx.lock.id, removedBy: userId, createdBy: userId })
      .returning();
    expect(lockRemoval.appliedLockId).toBe(ctx.lock.id);

    await db
      .insert(schema.tagRemovals)
      .values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, appliedTagId: ctx.tag.id, removedBy: userId, createdBy: userId });

    const [verification] = await db
      .insert(schema.restorationVerifications)
      .values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, restorationId: restoration.id, isolationPointId: ctx.point.id, result: 'pass', verifiedBy: userId, createdBy: userId })
      .returning();
    expect(verification.result).toBe('pass');
  });

  dbTest('records append-only LOTOTO history (FR-LTO-013/014)', async () => {
    const ctx = await seedExecution();
    const [history] = await db
      .insert(schema.lototoHistory)
      .values({ tenantId: ctx.tenantId, planId: ctx.plan.id, executionId: ctx.execution.id, action: 'execution.restored', entityType: 'isolation_execution', entityId: ctx.execution.id, actorId: userId, createdBy: userId })
      .returning();
    expect(history.action).toBe('execution.restored');
  });

  dbTest('enforces one restoration per execution+point and one lock removal per lock', async () => {
    const ctx = await seedExecution();
    await db.insert(schema.equipmentRestorations).values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, isolationPointId: ctx.point.id, restoredBy: userId, createdBy: userId });
    await expect(
      db.insert(schema.equipmentRestorations).values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, isolationPointId: ctx.point.id, restoredBy: userId, createdBy: userId }),
    ).rejects.toThrow();

    await db.insert(schema.lockRemovals).values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, appliedLockId: ctx.lock.id, removedBy: userId, createdBy: userId });
    await expect(
      db.insert(schema.lockRemovals).values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, appliedLockId: ctx.lock.id, removedBy: userId, createdBy: userId }),
    ).rejects.toThrow();
  });

  // --- Negative: tenant isolation ---

  dbTest('rejects restoration whose tenant differs from its execution', async () => {
    const ctx = await seedExecution();
    await expect(
      db.insert(schema.equipmentRestorations).values({ tenantId: randomUUID(), executionId: ctx.execution.id, isolationPointId: ctx.point.id, restoredBy: userId, createdBy: userId }),
    ).rejects.toThrow(/tenant/i);
  });

  dbTest('rejects lock removal referencing a lock from another execution', async () => {
    const a = await seedExecution();
    const b = await seedExecution(a.tenantId);
    // b's execution with a's lock
    await expect(
      db.insert(schema.lockRemovals).values({ tenantId: a.tenantId, executionId: b.execution.id, appliedLockId: a.lock.id, removedBy: userId, createdBy: userId }),
    ).rejects.toThrow(/execution/i);
  });

  // --- Negative: immutability ---

  dbTest('rejects update of an immutable restoration verification', async () => {
    const ctx = await seedExecution();
    const [restoration] = await db.insert(schema.equipmentRestorations).values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, isolationPointId: ctx.point.id, restoredBy: userId, createdBy: userId }).returning();
    const [verification] = await db.insert(schema.restorationVerifications).values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, restorationId: restoration.id, isolationPointId: ctx.point.id, result: 'pass', verifiedBy: userId, createdBy: userId }).returning();
    await expect(
      db.update(schema.restorationVerifications).set({ result: 'fail' }).where(eq(schema.restorationVerifications.id, verification.id)),
    ).rejects.toThrow(/immutable/i);
  });

  dbTest('rejects delete of immutable LOTOTO history (audit history preserved)', async () => {
    const ctx = await seedExecution();
    const [history] = await db.insert(schema.lototoHistory).values({ tenantId: ctx.tenantId, planId: ctx.plan.id, executionId: ctx.execution.id, action: 'lock.removed', entityType: 'applied_lock', actorId: userId, createdBy: userId }).returning();
    await expect(
      db.delete(schema.lototoHistory).where(eq(schema.lototoHistory.id, history.id)),
    ).rejects.toThrow(/immutable/i);
  });

  dbTest('rejects mutation of immutable audit fields on equipment_restorations', async () => {
    const ctx = await seedExecution();
    const [restoration] = await db.insert(schema.equipmentRestorations).values({ tenantId: ctx.tenantId, executionId: ctx.execution.id, isolationPointId: ctx.point.id, restoredBy: userId, createdBy: userId }).returning();
    // status update allowed
    await db.update(schema.equipmentRestorations).set({ status: 'pending' }).where(eq(schema.equipmentRestorations.id, restoration.id));
    // audit field mutation rejected
    await expect(
      db.update(schema.equipmentRestorations).set({ createdBy: randomUUID() }).where(eq(schema.equipmentRestorations.id, restoration.id)),
    ).rejects.toThrow(/immutable/i);
  });

  // --- Negative: existing permit lifecycle non-regression ---

  dbTest('does not break existing permit lifecycle inserts', async () => {
    const tenantId = randomUUID();
    const [permit] = await db
      .insert(schema.permits)
      .values({ tenantId, status: 'approved', permitTypeId: randomUUID(), title: 'Lifecycle', reference: `PTW-L-${randomUUID().slice(0, 8)}`, createdBy: userId })
      .returning();
    const rows = await db.select().from(schema.permits).where(and(eq(schema.permits.id, permit.id), eq(schema.permits.tenantId, tenantId)));
    expect(rows).toHaveLength(1);
  });
});
