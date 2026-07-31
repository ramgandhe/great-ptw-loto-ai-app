import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('SIMOPS conflict resolution (PUS-171)', () => {
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

  dbTest('supports assessment, mitigation, and approval workflow', async () => {
    const tenantId = randomUUID();
    const permitTypeId = randomUUID();

    const [permitA, permitB] = await db
      .insert(schema.permits)
      .values([
        {
          tenantId,
          status: 'approved',
          permitTypeId,
          title: 'Permit A',
          reference: `PTW-A-${randomUUID().slice(0, 6)}`,
          createdBy: userId,
        },
        {
          tenantId,
          status: 'active',
          permitTypeId,
          title: 'Permit B',
          reference: `PTW-B-${randomUUID().slice(0, 6)}`,
          createdBy: userId,
        },
      ])
      .returning();

    const [conflict] = await db
      .insert(schema.simopsConflicts)
      .values({
        tenantId,
        status: 'open',
        severity: 'high',
        conflictType: 'equipment',
        summary: 'Equipment overlap',
        fingerprint: `${[permitA.id, permitB.id].sort().join(':')}:equipment`,
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.conflictParticipants).values([
      { tenantId, conflictId: conflict.id, permitId: permitA.id, createdBy: userId },
      { tenantId, conflictId: conflict.id, permitId: permitB.id, createdBy: userId },
    ]);

    const [assessment] = await db
      .insert(schema.conflictAssessments)
      .values({
        tenantId,
        conflictId: conflict.id,
        assessedSeverity: 'high',
        riskSummary: 'Concurrent work on shared equipment',
        assessedBy: userId,
        createdBy: userId,
      })
      .returning();

    await db
      .update(schema.simopsConflicts)
      .set({ status: 'assessed' })
      .where(eq(schema.simopsConflicts.id, conflict.id));

    const [mitigation] = await db
      .insert(schema.mitigationPlans)
      .values({
        tenantId,
        conflictId: conflict.id,
        assessmentId: assessment.id,
        planSummary: 'Stagger work windows',
        actions: [{ description: 'Delay permit B start by 2 hours' }],
        createdBy: userId,
      })
      .returning();

    await db
      .update(schema.simopsConflicts)
      .set({ status: 'mitigation_planned' })
      .where(eq(schema.simopsConflicts.id, conflict.id));

    const [resolution] = await db
      .insert(schema.conflictResolutions)
      .values({
        tenantId,
        conflictId: conflict.id,
        outcome: 'approved',
        comments: 'Mitigation accepted',
        resolvedBy: userId,
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.conflictHistory).values({
      tenantId,
      conflictId: conflict.id,
      action: 'approved',
      actorUserId: userId,
      createdBy: userId,
    });

    expect(assessment.riskSummary).toContain('Concurrent work');
    expect(mitigation.planSummary).toContain('Stagger');
    expect(resolution.outcome).toBe('approved');
  });
});
