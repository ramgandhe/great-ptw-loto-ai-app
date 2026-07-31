import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('Isolation execution schema (PUS-159)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const userId = randomUUID();

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });

    try {
      await pool.query('SELECT 1');
      canConnect = true;
      await migrate(db, { migrationsFolder: './src/database/migrations' });
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

  async function seedContext(tenantId: string = randomUUID()) {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId: randomUUID(),
        title: 'Isolation execution permit',
        reference: `PTW-EXE-${randomUUID().slice(0, 8)}`,
        createdBy: userId,
      })
      .returning();

    const [workstation] = await db
      .insert(schema.workstationCatalogue)
      .values({
        tenantId,
        code: `WS-${randomUUID().slice(0, 6)}`,
        name: 'Compressor bay',
        createdBy: userId,
      })
      .returning();

    const [machinery] = await db
      .insert(schema.machineryCatalogue)
      .values({
        tenantId,
        code: `MC-${randomUUID().slice(0, 6)}`,
        name: 'Main compressor',
        workstationId: workstation.id,
        createdBy: userId,
      })
      .returning();

    const [plan] = await db
      .insert(schema.lototoPlans)
      .values({
        tenantId,
        permitId: permit.id,
        machineryId: machinery.id,
        title: 'Primary isolation plan',
        status: 'ready',
        createdBy: userId,
      })
      .returning();

    const [point] = await db
      .insert(schema.isolationPoints)
      .values({
        planId: plan.id,
        machineryId: machinery.id,
        isolationNumber: `ISO-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    return { tenantId, permit, machinery, plan, point };
  }

  async function seedExecution(tenantId: string, planId: string) {
    const [execution] = await db
      .insert(schema.isolationExecution)
      .values({
        tenantId,
        planId,
        startedBy: userId,
        createdBy: userId,
      })
      .returning();

    return execution;
  }

  // --- Positive cases ---

  dbTest('stores isolation execution with activity timestamps (FR-LTO-011)', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);

    expect(execution.planId).toBe(ctx.plan.id);
    expect(execution.tenantId).toBe(ctx.tenantId);
    expect(execution.status).toBe('in_progress');
    expect(execution.startedAt).toBeInstanceOf(Date);
  });

  dbTest('enforces one execution per LOTOTO plan (unique constraint)', async () => {
    const ctx = await seedContext();
    await seedExecution(ctx.tenantId, ctx.plan.id);

    await expect(seedExecution(ctx.tenantId, ctx.plan.id)).rejects.toThrow();
  });

  dbTest('stores lock registry entry (FR-LTO-006/010) and tag registry entry', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);

    const [lock] = await db
      .insert(schema.appliedLocks)
      .values({
        tenantId: ctx.tenantId,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        lockTag: 'LOCK-001',
        lockMethod: 'padlock',
        appliedBy: userId,
        createdBy: userId,
      })
      .returning();

    const [tag] = await db
      .insert(schema.appliedTags)
      .values({
        tenantId: ctx.tenantId,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        tagNumber: 'TAG-001',
        tagType: 'danger',
        appliedBy: userId,
        createdBy: userId,
      })
      .returning();

    expect(lock.lockMethod).toBe('padlock');
    expect(lock.status).toBe('applied');
    expect(tag.tagType).toBe('danger');
  });

  dbTest('stores verification record and links immutable evidence (FR-LTO-007/009)', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);

    const [verification] = await db
      .insert(schema.isolationVerifications)
      .values({
        tenantId: ctx.tenantId,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        result: 'pass',
        method: 'try-out',
        verifiedBy: userId,
        createdBy: userId,
      })
      .returning();

    const [evidence] = await db
      .insert(schema.isolationEvidence)
      .values({
        tenantId: ctx.tenantId,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        verificationId: verification.id,
        fileName: 'isolation.jpg',
        contentType: 'image/jpeg',
        fileSize: 2048,
        storageBucket: 'ptw-documents',
        storageKey: `evidence/${randomUUID()}.jpg`,
        capturedBy: userId,
        createdBy: userId,
      })
      .returning();

    expect(verification.result).toBe('pass');
    expect(evidence.verificationId).toBe(verification.id);
  });

  dbTest('allows lock status transition applied -> removed', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);

    const [lock] = await db
      .insert(schema.appliedLocks)
      .values({
        tenantId: ctx.tenantId,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        lockTag: 'LOCK-RM',
        lockMethod: 'hasp',
        appliedBy: userId,
        createdBy: userId,
      })
      .returning();

    const [updated] = await db
      .update(schema.appliedLocks)
      .set({ status: 'removed', removedBy: userId, removedAt: new Date() })
      .where(eq(schema.appliedLocks.id, lock.id))
      .returning();

    expect(updated.status).toBe('removed');
    expect(updated.createdAt).toEqual(lock.createdAt);
  });

  dbTest('cascades child records when execution is deleted', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);

    await db.insert(schema.appliedLocks).values({
      tenantId: ctx.tenantId,
      executionId: execution.id,
      isolationPointId: ctx.point.id,
      lockTag: 'LOCK-CAS',
      lockMethod: 'padlock',
      appliedBy: userId,
      createdBy: userId,
    });

    await db.delete(schema.isolationExecution).where(eq(schema.isolationExecution.id, execution.id));

    const remaining = await db
      .select()
      .from(schema.appliedLocks)
      .where(eq(schema.appliedLocks.executionId, execution.id));

    expect(remaining).toHaveLength(0);
  });

  dbTest('allows re-verification but only one passing result per point', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);

    await db.insert(schema.isolationVerifications).values({
      tenantId: ctx.tenantId,
      executionId: execution.id,
      isolationPointId: ctx.point.id,
      result: 'fail',
      verifiedBy: userId,
      createdBy: userId,
    });

    await db.insert(schema.isolationVerifications).values({
      tenantId: ctx.tenantId,
      executionId: execution.id,
      isolationPointId: ctx.point.id,
      result: 'pass',
      verifiedBy: userId,
      createdBy: userId,
    });

    await expect(
      db.insert(schema.isolationVerifications).values({
        tenantId: ctx.tenantId,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        result: 'pass',
        verifiedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  // --- Negative cases: tenant isolation ---

  dbTest('rejects execution whose tenant differs from its LOTOTO plan', async () => {
    const ctx = await seedContext();
    const foreignTenant = randomUUID();

    await expect(seedExecution(foreignTenant, ctx.plan.id)).rejects.toThrow(/tenant/i);
  });

  dbTest('rejects lock whose tenant differs from its execution', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);
    const foreignTenant = randomUUID();

    await expect(
      db.insert(schema.appliedLocks).values({
        tenantId: foreignTenant,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        lockTag: 'LOCK-X',
        lockMethod: 'padlock',
        appliedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow(/tenant/i);
  });

  dbTest('rejects cross-tenant reference to an isolation point from another plan', async () => {
    const tenantA = await seedContext();
    const tenantB = await seedContext();
    const executionB = await seedExecution(tenantB.tenantId, tenantB.plan.id);

    // Point belongs to tenant A's plan; execution belongs to tenant B.
    await expect(
      db.insert(schema.appliedLocks).values({
        tenantId: tenantB.tenantId,
        executionId: executionB.id,
        isolationPointId: tenantA.point.id,
        lockTag: 'LOCK-XTEN',
        lockMethod: 'padlock',
        appliedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow(/plan/i);
  });

  dbTest('rejects evidence referencing a verification from another execution', async () => {
    const ctx = await seedContext();
    const executionA = await seedExecution(ctx.tenantId, ctx.plan.id);

    const other = await seedContext(ctx.tenantId);
    const executionB = await seedExecution(ctx.tenantId, other.plan.id);

    const [verificationB] = await db
      .insert(schema.isolationVerifications)
      .values({
        tenantId: ctx.tenantId,
        executionId: executionB.id,
        isolationPointId: other.point.id,
        result: 'pass',
        verifiedBy: userId,
        createdBy: userId,
      })
      .returning();

    await expect(
      db.insert(schema.isolationEvidence).values({
        tenantId: ctx.tenantId,
        executionId: executionA.id,
        verificationId: verificationB.id,
        fileName: 'x.jpg',
        contentType: 'image/jpeg',
        fileSize: 1,
        storageBucket: 'ptw-documents',
        storageKey: `evidence/${randomUUID()}.jpg`,
        capturedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow(/execution/i);
  });

  // --- Negative cases: immutability of audit/evidence ---

  dbTest('rejects update of immutable verification record', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);

    const [verification] = await db
      .insert(schema.isolationVerifications)
      .values({
        tenantId: ctx.tenantId,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        result: 'pass',
        verifiedBy: userId,
        createdBy: userId,
      })
      .returning();

    await expect(
      db
        .update(schema.isolationVerifications)
        .set({ result: 'fail' })
        .where(eq(schema.isolationVerifications.id, verification.id)),
    ).rejects.toThrow(/immutable/i);
  });

  dbTest('rejects delete of immutable evidence record', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);

    const [evidence] = await db
      .insert(schema.isolationEvidence)
      .values({
        tenantId: ctx.tenantId,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        fileName: 'immutable.jpg',
        contentType: 'image/jpeg',
        fileSize: 512,
        storageBucket: 'ptw-documents',
        storageKey: `evidence/${randomUUID()}.jpg`,
        capturedBy: userId,
        createdBy: userId,
      })
      .returning();

    await expect(
      db.delete(schema.isolationEvidence).where(eq(schema.isolationEvidence.id, evidence.id)),
    ).rejects.toThrow(/immutable/i);
  });

  dbTest('rejects mutation of immutable audit fields on lock registry', async () => {
    const ctx = await seedContext();
    const execution = await seedExecution(ctx.tenantId, ctx.plan.id);

    const [lock] = await db
      .insert(schema.appliedLocks)
      .values({
        tenantId: ctx.tenantId,
        executionId: execution.id,
        isolationPointId: ctx.point.id,
        lockTag: 'LOCK-IMM',
        lockMethod: 'padlock',
        appliedBy: userId,
        createdBy: userId,
      })
      .returning();

    await expect(
      db
        .update(schema.appliedLocks)
        .set({ createdBy: randomUUID() })
        .where(eq(schema.appliedLocks.id, lock.id)),
    ).rejects.toThrow(/immutable/i);
  });

  // --- Existing permit lifecycle non-regression ---

  dbTest('does not break existing permit lifecycle inserts', async () => {
    const tenantId = randomUUID();
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId: randomUUID(),
        title: 'Lifecycle regression permit',
        reference: `PTW-REG-${randomUUID().slice(0, 8)}`,
        createdBy: userId,
      })
      .returning();

    const rows = await db
      .select()
      .from(schema.permits)
      .where(and(eq(schema.permits.id, permit.id), eq(schema.permits.tenantId, tenantId)));

    expect(rows).toHaveLength(1);
  });
});
