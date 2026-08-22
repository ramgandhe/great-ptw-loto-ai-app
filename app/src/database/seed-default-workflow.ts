import { sql } from 'drizzle-orm';
import type { Database } from './database.module';
import { DEFAULT_APPROVAL_WORKFLOW_STEPS } from '../modules/approval/default-workflow';
import { DEMO_IDS, DEMO_TENANT_ID, SEED_ACTOR_ID } from './seed-ids';

const WORKFLOW_STEP_IDS = [DEMO_IDS.workflowHodInitial] as const;

export async function seedDefaultWorkflow(db: Database): Promise<void> {
  console.log('Seeding PRD approval workflow (HOD initial review)...');

  for (const [index, step] of DEFAULT_APPROVAL_WORKFLOW_STEPS.entries()) {
    const stepId = WORKFLOW_STEP_IDS[index];
    await db.execute(sql`
      INSERT INTO "workflow_steps" (
        "id",
        "tenant_id",
        "permit_type_id",
        "step_sequence",
        "name",
        "approver_role",
        "created_by",
        "updated_by"
      )
      VALUES (
        ${stepId},
        ${DEMO_TENANT_ID},
        NULL,
        ${step.stepSequence},
        ${step.name},
        ${step.approverRole},
        ${SEED_ACTOR_ID},
        ${SEED_ACTOR_ID}
      )
      ON CONFLICT ("tenant_id", "step_sequence")
      WHERE "permit_type_id" IS NULL
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "approver_role" = EXCLUDED."approver_role",
        "is_active" = true,
        "updated_by" = ${SEED_ACTOR_ID},
        "updated_at" = now()
    `);
  }
}

export { DEFAULT_APPROVAL_WORKFLOW_STEPS, WORKFLOW_STEP_IDS };
export type WorkflowStepId = (typeof WORKFLOW_STEP_IDS)[number];
