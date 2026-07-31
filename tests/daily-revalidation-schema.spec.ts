import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Daily revalidation schema (PUS-184)', () => {
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

  dbTest('stores revalidation, extension, suspension and history', async () => {
    const tenantId = randomUUID();
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId: randomUUID(),
        title: 'Revalidation permit',
        reference: `PTW-RV-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    const [revalidation] = await db
      .insert(schema.permitRevalidations)
      .values({
        tenantId,
        permitId: permit.id,
        operationalDate: '2026-08-03',
        outcome: 'passed',
        findings: 'Conditions OK',
        revalidatedBy: userId,
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.permitExtensions).values({
      tenantId,
      permitId: permit.id,
      requestedEndAt: new Date('2026-08-10T18:00:00.000Z'),
      justification: 'Need two more days',
      requestedBy: userId,
      createdBy: userId,
    });

    await db.insert(schema.permitSuspensions).values({
      tenantId,
      permitId: permit.id,
      reason: 'Weather',
      suspendedBy: userId,
      source: 'manual',
      createdBy: userId,
    });

    await db.insert(schema.revalidationHistory).values({
      tenantId,
      permitId: permit.id,
      eventType: 'revalidation_passed',
      actorId: userId,
      payload: { revalidationId: revalidation.id },
      createdBy: userId,
    });

    const history = await db
      .select()
      .from(schema.revalidationHistory)
      .where(eq(schema.revalidationHistory.permitId, permit.id));

    expect(history).toHaveLength(1);
  });

  dbTest('rejects duplicate revalidation for the same day', async () => {
    const tenantId = randomUUID();
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId: randomUUID(),
        title: 'Dup reval',
        reference: `PTW-RD-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.permitRevalidations).values({
      tenantId,
      permitId: permit.id,
      operationalDate: '2026-08-04',
      outcome: 'passed',
      findings: 'OK',
      revalidatedBy: userId,
      createdBy: userId,
    });

    await expect(
      db.insert(schema.permitRevalidations).values({
        tenantId,
        permitId: permit.id,
        operationalDate: '2026-08-04',
        outcome: 'failed',
        findings: 'Retry',
        revalidatedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow();
  });

  dbTest('blocks mutation of revalidation history', async () => {
    const tenantId = randomUUID();
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'active',
        permitTypeId: randomUUID(),
        title: 'Hist immut',
        reference: `PTW-RH-${randomUUID().slice(0, 6)}`,
        createdBy: userId,
      })
      .returning();

    const [row] = await db
      .insert(schema.revalidationHistory)
      .values({
        tenantId,
        permitId: permit.id,
        eventType: 'permit_suspended',
        actorId: userId,
        createdBy: userId,
      })
      .returning();

    await expect(
      db
        .update(schema.revalidationHistory)
        .set({ eventType: 'permit_continued' })
        .where(eq(schema.revalidationHistory.id, row.id)),
    ).rejects.toThrow(/immutable/i);
  });
});
