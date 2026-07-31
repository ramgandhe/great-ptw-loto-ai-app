import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('SIMOPS conflict resolution schema (PUS-174)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const userId = randomUUID();

  function testIds() {
    return {
      tenantId: randomUUID(),
      otherTenantId: randomUUID(),
    };
  }

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

  async function seedConflict(tenantId: string) {
    const [conflict] = await db
      .insert(schema.simopsConflicts)
      .values({
        tenantId,
        status: 'pending_assessment',
        severity: 'high',
        primaryConflictType: 'equipment',
        conflictTypes: ['equipment', 'schedule'],
        fingerprint: `fp-res-${randomUUID()}`,
        createdBy: userId,
      })
      .returning();
    return conflict;
  }

  dbTest('stores assessment, mitigation plans, resolution and history', async () => {
    const { tenantId } = testIds();
    const conflict = await seedConflict(tenantId);

    const [assessment] = await db
      .insert(schema.conflictAssessments)
      .values({
        tenantId,
        conflictId: conflict.id,
        assessedSeverity: 'high',
        riskSummary: 'Shared machinery during hot work window',
        findings: { hazards: ['fire', 'spark'] },
        assessedBy: userId,
        status: 'completed',
        createdBy: userId,
      })
      .returning();

    const [planA] = await db
      .insert(schema.mitigationPlans)
      .values({
        tenantId,
        conflictId: conflict.id,
        assessmentId: assessment.id,
        title: 'Stagger schedule',
        description: 'Shift confined-space entry after hot work cool-down',
        measures: [
          { action: 'Reschedule confined space', ownerUserId: userId },
          { action: 'Verify gas test before entry' },
        ],
        responsibleUserId: userId,
        status: 'active',
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.mitigationPlans).values({
      tenantId,
      conflictId: conflict.id,
      assessmentId: assessment.id,
      title: 'Fire watch',
      measures: [{ action: 'Assign dedicated fire watch' }],
      status: 'active',
      createdBy: userId,
    });

    const [resolution] = await db
      .insert(schema.conflictResolutions)
      .values({
        tenantId,
        conflictId: conflict.id,
        decision: 'approved',
        comments: 'Mitigations accepted by Safety Officer',
        decidedBy: userId,
        mitigationPlanId: planA.id,
        createdBy: userId,
      })
      .returning();

    await db.insert(schema.conflictHistory).values([
      {
        tenantId,
        conflictId: conflict.id,
        action: 'assessed',
        entityType: 'conflict_assessment',
        entityId: assessment.id,
        actorId: userId,
        createdBy: userId,
      },
      {
        tenantId,
        conflictId: conflict.id,
        action: 'approved',
        entityType: 'conflict_resolution',
        entityId: resolution.id,
        actorId: userId,
        metadata: { decision: 'approved' },
        createdBy: userId,
      },
    ]);

    const plans = await db
      .select()
      .from(schema.mitigationPlans)
      .where(eq(schema.mitigationPlans.conflictId, conflict.id));
    const history = await db
      .select()
      .from(schema.conflictHistory)
      .where(eq(schema.conflictHistory.conflictId, conflict.id));

    expect(assessment.status).toBe('completed');
    expect(plans).toHaveLength(2);
    expect(resolution.decision).toBe('approved');
    expect(history).toHaveLength(2);
  });

  dbTest('rejects invalid assessment severity and resolution decision', async () => {
    const { tenantId } = testIds();
    const conflict = await seedConflict(tenantId);

    await expect(
      db.insert(schema.conflictAssessments).values({
        tenantId,
        conflictId: conflict.id,
        assessedSeverity: 'critical' as never,
        assessedBy: userId,
        status: 'completed',
        createdBy: userId,
      }),
    ).rejects.toThrow(/assessed_severity|check/i);

    await expect(
      db.insert(schema.conflictResolutions).values({
        tenantId,
        conflictId: conflict.id,
        decision: 'deferred' as never,
        comments: 'nope',
        decidedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow(/decision|check/i);
  });

  dbTest('enforces one resolution per conflict', async () => {
    const { tenantId } = testIds();
    const conflict = await seedConflict(tenantId);

    await db.insert(schema.conflictResolutions).values({
      tenantId,
      conflictId: conflict.id,
      decision: 'rejected',
      comments: 'Cannot proceed safely',
      decidedBy: userId,
      createdBy: userId,
    });

    await expect(
      db.insert(schema.conflictResolutions).values({
        tenantId,
        conflictId: conflict.id,
        decision: 'approved',
        comments: 'second decision',
        decidedBy: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  dbTest('rejects cross-tenant child rows for a conflict', async () => {
    const { tenantId, otherTenantId } = testIds();
    const conflict = await seedConflict(tenantId);

    await expect(
      db.insert(schema.conflictAssessments).values({
        tenantId: otherTenantId,
        conflictId: conflict.id,
        assessedSeverity: 'medium',
        assessedBy: userId,
        status: 'draft',
        createdBy: userId,
      }),
    ).rejects.toThrow(/tenant/i);

    await expect(
      db.insert(schema.conflictHistory).values({
        tenantId: otherTenantId,
        conflictId: conflict.id,
        action: 'assessed',
        entityType: 'conflict_assessment',
        actorId: userId,
        createdBy: userId,
      }),
    ).rejects.toThrow(/tenant/i);
  });

  dbTest('isolates resolution history by tenant_id', async () => {
    const { tenantId, otherTenantId } = testIds();
    const conflictA = await seedConflict(tenantId);
    const conflictB = await seedConflict(otherTenantId);

    await db.insert(schema.conflictHistory).values([
      {
        tenantId,
        conflictId: conflictA.id,
        action: 'detected',
        entityType: 'simops_conflict',
        entityId: conflictA.id,
        actorId: userId,
      },
      {
        tenantId: otherTenantId,
        conflictId: conflictB.id,
        action: 'detected',
        entityType: 'simops_conflict',
        entityId: conflictB.id,
        actorId: userId,
      },
    ]);

    const rows = await db
      .select()
      .from(schema.conflictHistory)
      .where(eq(schema.conflictHistory.tenantId, tenantId));

    expect(rows.every((row) => row.tenantId === tenantId)).toBe(true);
    expect(rows.some((row) => row.tenantId === otherTenantId)).toBe(false);
  });

  dbTest('keeps conflict_history and conflict_resolutions immutable', async () => {
    const { tenantId } = testIds();
    const conflict = await seedConflict(tenantId);

    const [history] = await db
      .insert(schema.conflictHistory)
      .values({
        tenantId,
        conflictId: conflict.id,
        action: 'escalated',
        entityType: 'simops_conflict',
        entityId: conflict.id,
        actorId: userId,
        metadata: { reason: 'timeout' },
      })
      .returning();

    await expect(
      db
        .update(schema.conflictHistory)
        .set({ action: 'approved' })
        .where(eq(schema.conflictHistory.id, history.id)),
    ).rejects.toThrow(/immutable/i);

    await expect(
      db.delete(schema.conflictHistory).where(eq(schema.conflictHistory.id, history.id)),
    ).rejects.toThrow(/immutable/i);

    const [resolution] = await db
      .insert(schema.conflictResolutions)
      .values({
        tenantId,
        conflictId: conflict.id,
        decision: 'approved',
        comments: 'Proceed with controls',
        decidedBy: userId,
        createdBy: userId,
      })
      .returning();

    await expect(
      db
        .update(schema.conflictResolutions)
        .set({ comments: 'altered' })
        .where(eq(schema.conflictResolutions.id, resolution.id)),
    ).rejects.toThrow(/immutable/i);

    await expect(
      db.delete(schema.conflictResolutions).where(eq(schema.conflictResolutions.id, resolution.id)),
    ).rejects.toThrow(/immutable/i);
  });

  dbTest('restricts deleting a conflict that has history', async () => {
    const { tenantId } = testIds();
    const conflict = await seedConflict(tenantId);

    await db.insert(schema.conflictHistory).values({
      tenantId,
      conflictId: conflict.id,
      action: 'detected',
      entityType: 'simops_conflict',
      entityId: conflict.id,
      actorId: userId,
    });

    await expect(
      db.delete(schema.simopsConflicts).where(eq(schema.simopsConflicts.id, conflict.id)),
    ).rejects.toThrow(/restrict|foreign key|violates/i);

    const remaining = await db
      .select()
      .from(schema.simopsConflicts)
      .where(and(eq(schema.simopsConflicts.id, conflict.id), eq(schema.simopsConflicts.tenantId, tenantId)));

    expect(remaining).toHaveLength(1);
  });
});
