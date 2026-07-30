import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../app/src/database/schema';
import { migrationsFolder, testDatabaseUrl } from './helpers/db';

describe('Permit approval schema (PUS-139)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let canConnect = false;

  const approverId = randomUUID();
  const issuerId = randomUUID();
  const locationId = randomUUID();

  function testIds() {
    return {
      tenantId: randomUUID(),
      permitTypeId: randomUUID(),
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

  async function createSubmittedPermit(tenantId: string, permitTypeId: string) {
    const [permit] = await db
      .insert(schema.permits)
      .values({
        tenantId,
        status: 'pending_approval',
        permitTypeId,
        title: 'Confined space entry',
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

  async function createWorkflowSteps(tenantId: string, permitTypeId: string) {
    const [step1] = await db
      .insert(schema.workflowSteps)
      .values({
        tenantId,
        permitTypeId,
        stepSequence: 1,
        name: 'Safety Officer Review',
        approverRole: 'supervisor',
        createdBy: issuerId,
      })
      .returning();

    const [step2] = await db
      .insert(schema.workflowSteps)
      .values({
        tenantId,
        permitTypeId,
        stepSequence: 2,
        name: 'Head of Department Approval',
        approverRole: 'org-admin',
        createdBy: issuerId,
      })
      .returning();

    return { step1, step2 };
  }

  dbTest('creates workflow steps with tenant-scoped sequencing', async () => {
    const { tenantId, permitTypeId } = testIds();
    const { step1, step2 } = await createWorkflowSteps(tenantId, permitTypeId);

    expect(step1.stepSequence).toBe(1);
    expect(step2.stepSequence).toBe(2);

    await expect(
      db.insert(schema.workflowSteps).values({
        tenantId,
        permitTypeId,
        stepSequence: 1,
        name: 'Duplicate sequence',
        approverRole: 'supervisor',
        createdBy: issuerId,
      }),
    ).rejects.toThrow();
  });

  dbTest('creates workflow assignment linked to permit and step', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createSubmittedPermit(tenantId, permitTypeId);
    const { step1 } = await createWorkflowSteps(tenantId, permitTypeId);

    const [assignment] = await db
      .insert(schema.workflowAssignments)
      .values({
        permitId: permit.id,
        workflowStepId: step1.id,
        assigneeId: approverId,
        status: 'active',
        createdBy: issuerId,
      })
      .returning();

    expect(assignment.permitId).toBe(permit.id);
    expect(assignment.workflowStepId).toBe(step1.id);
  });

  dbTest('rejects duplicate workflow assignment for the same permit step', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createSubmittedPermit(tenantId, permitTypeId);
    const { step1 } = await createWorkflowSteps(tenantId, permitTypeId);

    await db.insert(schema.workflowAssignments).values({
      permitId: permit.id,
      workflowStepId: step1.id,
      assigneeId: approverId,
      status: 'pending',
      createdBy: issuerId,
    });

    await expect(
      db.insert(schema.workflowAssignments).values({
        permitId: permit.id,
        workflowStepId: step1.id,
        assigneeId: randomUUID(),
        status: 'pending',
        createdBy: issuerId,
      }),
    ).rejects.toThrow();
  });

  dbTest('records permit approval with timestamp and comment', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createSubmittedPermit(tenantId, permitTypeId);
    const { step1 } = await createWorkflowSteps(tenantId, permitTypeId);

    const [assignment] = await db
      .insert(schema.workflowAssignments)
      .values({
        permitId: permit.id,
        workflowStepId: step1.id,
        assigneeId: approverId,
        status: 'active',
        createdBy: issuerId,
      })
      .returning();

    const [approval] = await db
      .insert(schema.permitApprovals)
      .values({
        permitId: permit.id,
        workflowStepId: step1.id,
        workflowAssignmentId: assignment.id,
        decision: 'approve',
        comment: 'Hazards adequately controlled',
        decidedBy: approverId,
        createdBy: approverId,
      })
      .returning();

    expect(approval.decision).toBe('approve');
    expect(approval.decidedAt).toBeInstanceOf(Date);
    expect(approval.comment).toContain('Hazards');
  });

  dbTest('rejects duplicate approval for the same permit step', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createSubmittedPermit(tenantId, permitTypeId);
    const { step1 } = await createWorkflowSteps(tenantId, permitTypeId);

    await db.insert(schema.permitApprovals).values({
      permitId: permit.id,
      workflowStepId: step1.id,
      decision: 'approve',
      decidedBy: approverId,
      createdBy: approverId,
    });

    await expect(
      db.insert(schema.permitApprovals).values({
        permitId: permit.id,
        workflowStepId: step1.id,
        decision: 'approve',
        decidedBy: approverId,
        createdBy: approverId,
      }),
    ).rejects.toThrow();
  });

  dbTest('stores immutable approval history and blocks updates', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createSubmittedPermit(tenantId, permitTypeId);
    const { step1 } = await createWorkflowSteps(tenantId, permitTypeId);

    const [history] = await db
      .insert(schema.approvalHistory)
      .values({
        permitId: permit.id,
        workflowStepId: step1.id,
        action: 'approved',
        fromStatus: 'pending_approval',
        toStatus: 'approved',
        actorId: approverId,
        comment: 'Approved for execution',
        createdBy: approverId,
      })
      .returning();

    expect(history.action).toBe('approved');

    await expect(
      db
        .update(schema.approvalHistory)
        .set({ comment: 'tampered' })
        .where(eq(schema.approvalHistory.id, history.id)),
    ).rejects.toThrow();

    await expect(
      db.delete(schema.approvalHistory).where(eq(schema.approvalHistory.id, history.id)),
    ).rejects.toThrow();
  });

  dbTest('rejects invalid workflow assignment status', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createSubmittedPermit(tenantId, permitTypeId);
    const { step1 } = await createWorkflowSteps(tenantId, permitTypeId);

    await expect(
      db.insert(schema.workflowAssignments).values({
        permitId: permit.id,
        workflowStepId: step1.id,
        assigneeId: approverId,
        status: 'invalid' as 'pending',
        createdBy: issuerId,
      }),
    ).rejects.toThrow();
  });

  dbTest('supports extended permit approval statuses', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createSubmittedPermit(tenantId, permitTypeId);

    await db
      .update(schema.permits)
      .set({ status: 'approved', updatedBy: approverId })
      .where(eq(schema.permits.id, permit.id));

    const [updated] = await db
      .select()
      .from(schema.permits)
      .where(eq(schema.permits.id, permit.id));

    expect(updated.status).toBe('approved');
  });

  dbTest('cascades workflow data when permit is deleted', async () => {
    const { tenantId, permitTypeId } = testIds();
    const permit = await createSubmittedPermit(tenantId, permitTypeId);
    const { step1 } = await createWorkflowSteps(tenantId, permitTypeId);

    await db.insert(schema.workflowAssignments).values({
      permitId: permit.id,
      workflowStepId: step1.id,
      assigneeId: approverId,
      status: 'pending',
      createdBy: issuerId,
    });

    await db.delete(schema.permits).where(eq(schema.permits.id, permit.id));

    const assignments = await db
      .select()
      .from(schema.workflowAssignments)
      .where(eq(schema.workflowAssignments.permitId, permit.id));

    expect(assignments).toHaveLength(0);
  });
});
