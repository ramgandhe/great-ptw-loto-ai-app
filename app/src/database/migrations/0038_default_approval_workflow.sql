ALTER TABLE "approval_workflows" ADD COLUMN IF NOT EXISTS "approver_role" varchar(64);
ALTER TABLE "approval_workflows" ADD COLUMN IF NOT EXISTS "is_current" boolean NOT NULL DEFAULT false;
ALTER TABLE "approval_workflows" ADD COLUMN IF NOT EXISTS "workflow_step_id" uuid;

CREATE UNIQUE INDEX IF NOT EXISTS "approval_workflows_tenant_current_unique"
  ON "approval_workflows" ("tenant_id")
  WHERE "is_current" = true AND "status" <> 'archived';

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
  o."tenant_id",
  NULL,
  1,
  'HOD initial review',
  'hod',
  o."created_by",
  o."updated_by"
FROM "organisations" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "workflow_steps" ws
  WHERE ws."tenant_id" = o."tenant_id"
    AND ws."permit_type_id" IS NULL
    AND ws."is_active" = true
);

INSERT INTO "approval_workflows" (
  "id",
  "tenant_id",
  "name",
  "code",
  "description",
  "approver_role",
  "is_current",
  "workflow_step_id",
  "status",
  "created_by",
  "updated_by"
)
SELECT
  gen_random_uuid(),
  o."tenant_id",
  'Platform default',
  'PLATFORM_DEFAULT',
  'HOD initial review',
  'hod',
  true,
  (
    SELECT ws."id"
    FROM "workflow_steps" ws
    WHERE ws."tenant_id" = o."tenant_id"
      AND ws."permit_type_id" IS NULL
      AND ws."is_active" = true
    ORDER BY ws."step_sequence"
    LIMIT 1
  ),
  'active',
  o."created_by",
  o."updated_by"
FROM "organisations" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "approval_workflows" aw
  WHERE aw."tenant_id" = o."tenant_id"
    AND aw."status" <> 'archived'
);

UPDATE "approval_workflows" SET "is_current" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("tenant_id") "id"
  FROM "approval_workflows"
  WHERE "status" <> 'archived'
  ORDER BY "tenant_id", "created_at"
)
AND "tenant_id" NOT IN (
  SELECT "tenant_id"
  FROM "approval_workflows"
  WHERE "is_current" = true
    AND "status" <> 'archived'
);
