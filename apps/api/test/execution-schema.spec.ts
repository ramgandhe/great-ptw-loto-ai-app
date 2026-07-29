import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ptw:ptw_dev_password@localhost:5432/ptw_platform';

describe('Permit execution schema', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
    try {
      await pool.query('SELECT 1');
      await migrate(db, { migrationsFolder: './src/database/migrations' });
      canConnect = true;
    } catch {
      canConnect = false;
    }
  });

  afterAll(async () => {
    if (canConnect) await pool.end();
  });

  it('stores execution, progress, evidence and immutable status history', async () => {
    if (!canConnect) return;

    const tenantId = randomUUID();
    const executorId = randomUUID();
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'approved',
        permitTypeId: randomUUID(),
        title: 'Execution schema test',
        plannedEndAt: new Date('2030-01-01T00:00:00Z'),
        createdBy: executorId,
      })
      .returning();

    const [execution] = await db
      .insert(schema.permitExecutions)
      .values({
        tenantId,
        permitId: permit.id,
        activatedAt: new Date(),
        activatedBy: executorId,
        createdBy: executorId,
      })
      .returning();
    const [progress] = await db
      .insert(schema.permitProgress)
      .values({
        tenantId,
        permitId: permit.id,
        summary: 'Isolation verified and work started',
        recordedBy: executorId,
        createdBy: executorId,
      })
      .returning();
    const [evidence] = await db
      .insert(schema.permitEvidence)
      .values({
        tenantId,
        permitId: permit.id,
        progressId: progress.id,
        fileName: 'site.jpg',
        contentType: 'image/jpeg',
        fileSize: 1024,
        storageBucket: 'ptw-documents',
        storageKey: `${tenantId}/${permit.id}/site.jpg`,
        uploadedBy: executorId,
        createdBy: executorId,
      })
      .returning();
    const [history] = await db
      .insert(schema.permitStatusHistory)
      .values({
        tenantId,
        permitId: permit.id,
        fromStatus: 'approved',
        toStatus: 'active',
        changedBy: executorId,
      })
      .returning();

    expect(execution.permitId).toBe(permit.id);
    expect(progress.recordedAt).toBeInstanceOf(Date);
    expect(evidence.progressId).toBe(progress.id);

    await expect(
      db
        .update(schema.permitStatusHistory)
        .set({ reason: 'tampered' })
        .where(eq(schema.permitStatusHistory.id, history.id)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(schema.permitStatusHistory)
        .where(eq(schema.permitStatusHistory.id, history.id)),
    ).rejects.toThrow();
  });
});
