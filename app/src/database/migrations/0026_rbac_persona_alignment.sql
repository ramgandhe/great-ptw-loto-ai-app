-- Align stored role/kind values with PRD personas (supervisor → hod, etc.)

-- Drop constraints first so legacy values can be updated safely.
ALTER TABLE "dashboard_preferences"
  DROP CONSTRAINT IF EXISTS "dashboard_preferences_kind_check";

ALTER TABLE "kpi_cache"
  DROP CONSTRAINT IF EXISTS "kpi_cache_dashboard_kind_check";

ALTER TABLE "lototo_assignments"
  DROP CONSTRAINT IF EXISTS "lototo_assignments_role_check";

ALTER TABLE "lototo_assignments" DISABLE TRIGGER lototo_assignments_plan_locked;

UPDATE "workflow_steps"
SET "approver_role" = 'hod'
WHERE "approver_role" = 'supervisor';

UPDATE "lototo_assignments"
SET "role" = 'operator'
WHERE "role" IN ('isolation_officer', 'isolation-officer');

UPDATE "lototo_assignments"
SET "role" = 'safety-officer'
WHERE "role" = 'verifier';

UPDATE "lototo_assignments"
SET "role" = 'hod'
WHERE "role" = 'supervisor';

ALTER TABLE "lototo_assignments" ENABLE TRIGGER lototo_assignments_plan_locked;

UPDATE "dashboard_preferences"
SET "dashboard_kind" = 'hod'
WHERE "dashboard_kind" = 'supervisor';

UPDATE "kpi_cache"
SET "dashboard_kind" = 'hod'
WHERE "dashboard_kind" = 'supervisor';

ALTER TABLE "dashboard_preferences"
  ADD CONSTRAINT "dashboard_preferences_kind_check"
  CHECK ("dashboard_kind" IN ('personal', 'hod', 'safety', 'management'));

ALTER TABLE "kpi_cache"
  ADD CONSTRAINT "kpi_cache_dashboard_kind_check"
  CHECK (
    "dashboard_kind" IS NULL
    OR "dashboard_kind" IN ('personal', 'hod', 'safety', 'management')
  );

ALTER TABLE "lototo_assignments"
  ADD CONSTRAINT "lototo_assignments_role_check"
  CHECK ("role" IN ('operator', 'safety-officer', 'hod'));
