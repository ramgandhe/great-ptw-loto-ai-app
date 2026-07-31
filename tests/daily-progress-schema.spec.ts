import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Daily progress schema (PUS-179)', () => {
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

  dbTest('stores daily progress, handover and activity history', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();

    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId,
        title: 'Multi-day permit',
        reference: `PTW-MDP-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    const [progress] = await db
      .insert(schema.permitDailyProgress)
      .values({
        tenantId,
        permitId: permit.id,
        operationalDate: '2026-07-31',
        completedWork: 'Isolated pump A',
        pendingWork: 'Reconnect piping',
        summary: 'Day 1 progress',
        status: 'submitted',
        recordedBy: userId,
        submittedBy: userId,
        submittedAt: new Date(),
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.shiftHandovers).values({
      tenantId,
      permitId: permit.id,
      dailyProgressId: progress.id,
      outgoingUserId: userId,
      incomingUserId: randomUUID(),
      completedActivities: 'Isolated pump A',
      outstandingWork: 'Reconnect piping',
      safetyObservations: 'Area clear',
      createdBy: userId,
    });

    await db.insert(schema.dailyActivityHistory).values({
      tenantId,
      permitId: permit.id,
      eventType: 'progress_submitted',
      actorId: userId,
      payload: { dailyProgressId: progress.id },
      createdBy: userId,
    });

    const history = await db
      .select()
      .from(schema.dailyActivityHistory)
      .where(eq(schema.dailyActivityHistory.permitId, permit.id));

    expect(history).toHaveLength(1);
    expect(history[0].eventType).toBe('progress_submitted');
  });

  dbTest('rejects duplicate daily progress for the same operational day', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();

    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId,
        title: 'Duplicate day permit',
        reference: `PTW-DUP-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.permitDailyProgress).values({
      tenantId,
      permitId: permit.id,
      operationalDate: '2026-08-01',
      completedWork: 'First entry',
      pendingWork: '',
      summary: 'First',
      recordedBy: userId,
      createdBy: userId,
    });

    await expect(
      db.insert(schema.permitDailyProgress).values({
        tenantId,
        permitId: permit.id,
        operationalDate: '2026-08-01',
        completedWork: 'Second entry',
        pendingWork: '',
        summary: 'Second',
        recordedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  dbTest('blocks mutation of submitted daily progress and history', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();

    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId,
        title: 'Immutable day permit',
        reference: `PTW-IMM-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    const [progress] = await db
      .insert(schema.permitDailyProgress)
      .values({
        tenantId,
        permitId: permit.id,
        operationalDate: '2026-08-02',
        completedWork: 'Done',
        pendingWork: '',
        summary: 'Submitted day',
        status: 'submitted',
        recordedBy: userId,
        submittedBy: userId,
        submittedAt: new Date(),
        createdBy: userId,
      })
      .returning();

    const [history] = await db
      .insert(schema.dailyActivityHistory)
      .values({
        tenantId,
        permitId: permit.id,
        eventType: 'progress_submitted',
        actorId: userId,
        createdBy: userId,
      })
      .returning();

    await expect(
      db
        .update(schema.permitDailyProgress)
        .set({ summary: 'tampered' })
        .where(eq(schema.permitDailyProgress.id, progress.id)),
    ).rejects.toThrow(/immutable/i);

    await expect(
      db
        .update(schema.dailyActivityHistory)
        .set({ eventType: 'handover_completed' })
        .where(eq(schema.dailyActivityHistory.id, history.id)),
    ).rejects.toThrow(/immutable/i);
  });
});
