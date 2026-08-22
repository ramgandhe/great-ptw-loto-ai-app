-- Pre-execution approval is HOD initial review only; executor steps are creation/execution.

UPDATE "workflow_steps"
SET
  "is_active" = false,
  "updated_at" = now()
WHERE "permit_type_id" IS NULL
  AND "step_sequence" > 1;

UPDATE "workflow_steps"
SET
  "name" = 'HOD initial review',
  "approver_role" = 'hod',
  "is_active" = true,
  "updated_at" = now()
WHERE "permit_type_id" IS NULL
  AND "step_sequence" = 1;
