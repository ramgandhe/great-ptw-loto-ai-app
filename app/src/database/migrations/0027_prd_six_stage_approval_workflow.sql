-- Align default approval workflow with PRD §6.1:
-- Issuer → Executor → HOD → Executor → Issuer → HOD

UPDATE "workflow_steps"
SET
  "name" = 'Issuer submission',
  "approver_role" = 'job-issuer',
  "updated_at" = now()
WHERE "permit_type_id" IS NULL
  AND "step_sequence" = 1;

UPDATE "workflow_steps"
SET
  "name" = 'Executor operational details',
  "approver_role" = 'operator',
  "updated_at" = now()
WHERE "permit_type_id" IS NULL
  AND "step_sequence" = 2;

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
SELECT
  gen_random_uuid(),
  tenants."tenant_id",
  NULL,
  step_def."step_sequence",
  step_def."name",
  step_def."approver_role",
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000010'
FROM (
  SELECT DISTINCT "tenant_id"
  FROM "workflow_steps"
  WHERE "permit_type_id" IS NULL
) AS tenants
CROSS JOIN (
  VALUES
    (3, 'HOD initial review', 'hod'),
    (4, 'Executor pre-work confirmation', 'operator'),
    (5, 'Issuer completion approval', 'job-issuer'),
    (6, 'HOD final approval', 'hod')
) AS step_def("step_sequence", "name", "approver_role")
WHERE NOT EXISTS (
  SELECT 1
  FROM "workflow_steps" existing
  WHERE existing."tenant_id" = tenants."tenant_id"
    AND existing."permit_type_id" IS NULL
    AND existing."step_sequence" = step_def."step_sequence"
);
