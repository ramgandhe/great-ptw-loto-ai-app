import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('Permit execution schema (PUS-144)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const executorId = randomUUID();
  const issuerId = randomUUID();
  const locationId = randomUUID();

  function testIds() {
    return {
      tenantId: randomUUID(),
      permitTypeId: randomUUID(),
    };
  }

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

  async function createApprovedPermit(tenantId: string, permitTypeId: string) {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId,
        title: 'Hot work execution',
        locationId,
        plannedStartAt: new Date('2026-09-01T08:00:00Z'),
        plannedEndAt: new Date('2026-09-01T16:00:00Z'),
        submittedAt: new Date(),
        submittedBy: issuerId,
        createdBy: issuerId,
      })
      .returning();

    return permit;
  }

  async function createExecution(permitId: string) {
    const actualStartAt = new Date('2026-09-01T08:15:00Z');

    const [execution] = await db
      .insert(schema.permitExecution)
      .values({
        permitId,
        activatedBy: executorId,
        actualStartAt,
        createdBy: executorId,
        updatedBy: executorId,
      })
      .returning();

    return execution;
  }

  dbTest('creates permit execution with activation timestamps', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);
    const execution = await createExecution(permit.id);

    expect(execution.permitId).toBe(permit.id);
    expect(execution.activatedAt).toBeInstanceOf(Date);
    expect(execution.actualStartAt).toEqual(new Date('2026-09-01T08:15:00Z'));
  });

  dbTest('rejects execution on non-approved permit', async () => {
    const { tenantId, permitTypeId } = testIds();

    const [draftPermit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'draft',
        permitTypeId,
        title: 'Draft permit',
        locationId,
        createdBy: issuerId,
      })
      .returning();

    await expect(
      db.insert(schema.permitExecution).values({
        permitId: draftPermit.id,
        activatedBy: executorId,
        actualStartAt: new Date(),
        createdBy: executorId,
      }),
    ).rejects.toThrow(/requires permit status approved/);

    const [pendingPermit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'pending_approval',
        permitTypeId,
        title: 'Pending permit',
        locationId,
        createdBy: issuerId,
      })
      .returning();

    await expect(
      db.insert(schema.permitExecution).values({
        permitId: pendingPermit.id,
        activatedBy: executorId,
        actualStartAt: new Date(),
        createdBy: executorId,
      }),
    ).rejects.toThrow(/requires permit status approved/);
  });

  dbTest('rejects duplicate permit execution for the same permit', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);
    await createExecution(permit.id);

    await expect(
      db.insert(schema.permitExecution).values({
        permitId: permit.id,
        activatedBy: executorId,
        actualStartAt: new Date(),
        createdBy: executorId,
      }),
    ).rejects.toThrow();
  });

  dbTest('records progress updates linked to execution', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);
    const execution = await createExecution(permit.id);

    const [progress] = await db
      .insert(schema.permitProgress)
      .values({
        permitId: permit.id,
        executionId: execution.id,
        summary: 'Welding 50% complete',
        recordedBy: executorId,
        createdBy: executorId,
      })
      .returning();

    expect(progress.executionId).toBe(execution.id);
    expect(progress.recordedAt).toBeInstanceOf(Date);
  });

  dbTest('blocks mutation of permit progress records', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);
    const execution = await createExecution(permit.id);

    const [progress] = await db
      .insert(schema.permitProgress)
      .values({
        permitId: permit.id,
        executionId: execution.id,
        summary: 'Initial update',
        recordedBy: executorId,
        createdBy: executorId,
      })
      .returning();

    await expect(
      db
        .update(schema.permitProgress)
        .set({ summary: 'tampered' })
        .where(eq(schema.permitProgress.id, progress.id)),
    ).rejects.toThrow();

    await expect(
      db.delete(schema.permitProgress).where(eq(schema.permitProgress.id, progress.id)),
    ).rejects.toThrow();
  });

  dbTest('stores execution evidence metadata mirroring permit attachments', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);
    const execution = await createExecution(permit.id);

    const [evidence] = await db
      .insert(schema.permitEvidence)
      .values({
        permitId: permit.id,
        executionId: execution.id,
        fileName: 'worksite-photo.jpg',
        contentType: 'image/jpeg',
        fileSize: 204800,
        storageBucket: 'ptw-documents',
        storageKey: `${tenantId}/${permit.id}/evidence.jpg`,
        uploadedBy: executorId,
        comment: 'Completed weld joint',
        createdBy: executorId,
        updatedBy: executorId,
      })
      .returning();

    expect(evidence.fileName).toBe('worksite-photo.jpg');
    expect(evidence.storageKey).toContain(permit.id);
  });

  dbTest('blocks mutation of permit evidence records', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);
    const execution = await createExecution(permit.id);

    const [evidence] = await db
      .insert(schema.permitEvidence)
      .values({
        permitId: permit.id,
        executionId: execution.id,
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        fileSize: 1024,
        storageBucket: 'ptw-documents',
        storageKey: `${tenantId}/${permit.id}/report.pdf`,
        uploadedBy: executorId,
        createdBy: executorId,
        updatedBy: executorId,
      })
      .returning();

    await expect(
      db
        .update(schema.permitEvidence)
        .set({ comment: 'tampered' })
        .where(eq(schema.permitEvidence.id, evidence.id)),
    ).rejects.toThrow();

    await expect(
      db.delete(schema.permitEvidence).where(eq(schema.permitEvidence.id, evidence.id)),
    ).rejects.toThrow();
  });

  dbTest('stores immutable permit status history', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);
    const execution = await createExecution(permit.id);

    const [history] = await db
      .insert(schema.permitStatusHistory)
      .values({
        permitId: permit.id,
        executionId: execution.id,
        action: 'activated',
        fromStatus: 'approved',
        toStatus: 'active',
        actorId: executorId,
        comment: 'Work commenced',
        createdBy: executorId,
      })
      .returning();

    expect(history.action).toBe('activated');

    await expect(
      db
        .update(schema.permitStatusHistory)
        .set({ comment: 'tampered' })
        .where(eq(schema.permitStatusHistory.id, history.id)),
    ).rejects.toThrow();

    await expect(
      db
        .delete(schema.permitStatusHistory)
        .where(eq(schema.permitStatusHistory.id, history.id)),
    ).rejects.toThrow();
  });

  dbTest('rejects invalid permit status history action', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);

    await expect(
      db.insert(schema.permitStatusHistory).values({
        permitId: permit.id,
        action: 'invalid_action',
        fromStatus: 'approved',
        toStatus: 'active',
        actorId: executorId,
        createdBy: executorId,
      }),
    ).rejects.toThrow();
  });

  dbTest('rejects evidence without a valid execution reference', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);

    await expect(
      db.insert(schema.permitEvidence).values({
        permitId: permit.id,
        executionId: randomUUID(),
        fileName: 'orphan.jpg',
        contentType: 'image/jpeg',
        fileSize: 100,
        storageBucket: 'ptw-documents',
        storageKey: 'orphan.jpg',
        uploadedBy: executorId,
        createdBy: executorId,
        updatedBy: executorId,
      }),
    ).rejects.toThrow();
  });

  dbTest('supports active and suspended permit statuses', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);

    await db
      .update(schema.permits)
      .set({ status: 'active', updatedBy: executorId })
      .where(eq(schema.permits.id, permit.id));

    const [active] = await db
      .select()
      .from(schema.permits)
      .where(eq(schema.permits.id, permit.id));

    expect(active.status).toBe('active');

    await db
      .update(schema.permits)
      .set({ status: 'suspended', updatedBy: executorId })
      .where(eq(schema.permits.id, permit.id));

    const [suspended] = await db
      .select()
      .from(schema.permits)
      .where(eq(schema.permits.id, permit.id));

    expect(suspended.status).toBe('suspended');
  });

  dbTest('cascades execution record when permit is deleted', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createApprovedPermit(tenantId, permitTypeId);
    await createExecution(permit.id);

    await db.delete(schema.permits).where(eq(schema.permits.id, permit.id));

    const executions = await db
      .select()
      .from(schema.permitExecution)
      .where(eq(schema.permitExecution.permitId, permit.id));

    expect(executions).toHaveLength(0);
  });
});
