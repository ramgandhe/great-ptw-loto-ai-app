import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { approvalWorkflows, organisations, workflowSteps } from '../../database/schema';
import {
  DEFAULT_APPROVAL_WORKFLOW_STEPS,
  PLATFORM_DEFAULT_WORKFLOW_CODE,
  PLATFORM_DEFAULT_WORKFLOW_NAME,
} from './default-workflow';

type WorkflowDb = Pick<Database, 'insert' | 'select' | 'update'>;

export async function ensureDefaultApprovalWorkflow(
  db: WorkflowDb,
  tenantId: string,
  actorId: string | null | undefined,
  options?: { defaultStepId?: string },
): Promise<void> {
  const existingSteps = await db
    .select({
      id: workflowSteps.id,
      name: workflowSteps.name,
      approverRole: workflowSteps.approverRole,
    })
    .from(workflowSteps)
    .where(
      and(
        eq(workflowSteps.tenantId, tenantId),
        isNull(workflowSteps.permitTypeId),
        eq(workflowSteps.isActive, true),
      ),
    );

  let stepId = existingSteps[0]?.id;
  let stepName = existingSteps[0]?.name ?? DEFAULT_APPROVAL_WORKFLOW_STEPS[0].name;
  let approverRole = existingSteps[0]?.approverRole ?? DEFAULT_APPROVAL_WORKFLOW_STEPS[0].approverRole;

  if (!stepId) {
    const inserted = await db
      .insert(workflowSteps)
      .values(
        DEFAULT_APPROVAL_WORKFLOW_STEPS.map((step, index) => ({
          ...(index === 0 && options?.defaultStepId ? { id: options.defaultStepId } : {}),
          tenantId,
          permitTypeId: null,
          stepSequence: step.stepSequence,
          name: step.name,
          approverRole: step.approverRole,
          createdBy: actorId ?? null,
          updatedBy: actorId ?? null,
        })),
      )
      .returning({
        id: workflowSteps.id,
        name: workflowSteps.name,
        approverRole: workflowSteps.approverRole,
      });
    stepId = inserted[0].id;
    stepName = inserted[0].name;
    approverRole = inserted[0].approverRole;
  }

  const existingCatalog = await db
    .select({ id: approvalWorkflows.id })
    .from(approvalWorkflows)
    .where(and(eq(approvalWorkflows.tenantId, tenantId), ne(approvalWorkflows.status, 'archived')));

  if (existingCatalog.length > 0) {
    return;
  }

  await db.insert(approvalWorkflows).values({
    tenantId,
    name: PLATFORM_DEFAULT_WORKFLOW_NAME,
    code: PLATFORM_DEFAULT_WORKFLOW_CODE,
    description: stepName,
    approverRole,
    isCurrent: true,
    workflowStepId: stepId,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
  });
}

export async function applyCurrentWorkflowToLiveStep(
  db: WorkflowDb,
  tenantId: string,
  actorId: string | null | undefined,
  workflow: { name: string; approverRole: string; workflowStepId?: string | null },
): Promise<string> {
  let stepId = workflow.workflowStepId ?? null;

  if (!stepId) {
    const [existing] = await db
      .select({ id: workflowSteps.id })
      .from(workflowSteps)
      .where(
        and(
          eq(workflowSteps.tenantId, tenantId),
          isNull(workflowSteps.permitTypeId),
          eq(workflowSteps.isActive, true),
        ),
      )
      .orderBy(asc(workflowSteps.stepSequence));
    stepId = existing?.id ?? null;
  }

  if (!stepId) {
    await ensureDefaultApprovalWorkflow(db, tenantId, actorId);
    const created = await db
      .select({ id: workflowSteps.id })
      .from(workflowSteps)
      .where(
        and(
          eq(workflowSteps.tenantId, tenantId),
          isNull(workflowSteps.permitTypeId),
          eq(workflowSteps.isActive, true),
        ),
      );
    stepId = created[0].id;
  }

  await db
    .update(workflowSteps)
    .set({
      name: workflow.name,
      approverRole: workflow.approverRole,
      isActive: true,
      updatedBy: actorId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(workflowSteps.id, stepId));

  await db
    .update(workflowSteps)
    .set({
      isActive: false,
      updatedBy: actorId ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workflowSteps.tenantId, tenantId),
        isNull(workflowSteps.permitTypeId),
        ne(workflowSteps.id, stepId),
      ),
    );

  return stepId;
}

export async function ensureDefaultApprovalWorkflowForAllTenants(
  db: WorkflowDb,
  actorId: string | null | undefined,
): Promise<void> {
  const orgs = await db.select({ tenantId: organisations.tenantId }).from(organisations);
  for (const org of orgs) {
    await ensureDefaultApprovalWorkflow(db, org.tenantId, actorId);
  }
}