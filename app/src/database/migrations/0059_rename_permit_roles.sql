-- Rename stored RBAC role values: job-issuer → permit-receiver, hod → permit-approver, operator → permit-operator.
-- Dashboard kind "hod" is a dashboard type, not a realm role — leave it unchanged.

ALTER TABLE "lototo_assignments" DROP CONSTRAINT IF EXISTS "lototo_assignments_role_check";
ALTER TABLE "lototo_assignments" DISABLE TRIGGER lototo_assignments_plan_locked;

UPDATE "tenant_users" SET "role" = 'permit-receiver' WHERE "role" = 'job-issuer';
UPDATE "tenant_users" SET "role" = 'permit-approver' WHERE "role" = 'hod';
UPDATE "tenant_users" SET "role" = 'permit-operator' WHERE "role" = 'operator';

UPDATE "workflow_steps" SET "approver_role" = 'permit-receiver' WHERE "approver_role" = 'job-issuer';
UPDATE "workflow_steps" SET "approver_role" = 'permit-approver' WHERE "approver_role" = 'hod';
UPDATE "workflow_steps" SET "approver_role" = 'permit-operator' WHERE "approver_role" = 'operator';

UPDATE "approval_workflows" SET "approver_role" = 'permit-receiver' WHERE "approver_role" = 'job-issuer';
UPDATE "approval_workflows" SET "approver_role" = 'permit-approver' WHERE "approver_role" = 'hod';
UPDATE "approval_workflows" SET "approver_role" = 'permit-operator' WHERE "approver_role" = 'operator';

UPDATE "lototo_assignments" SET "role" = 'permit-operator' WHERE "role" = 'operator';
UPDATE "lototo_assignments" SET "role" = 'permit-approver' WHERE "role" = 'hod';

UPDATE "lototo_procedure_authorized_roles" SET "role" = 'permit-receiver' WHERE "role" = 'job-issuer';
UPDATE "lototo_procedure_authorized_roles" SET "role" = 'permit-approver' WHERE "role" = 'hod';
UPDATE "lototo_procedure_authorized_roles" SET "role" = 'permit-operator' WHERE "role" = 'operator';

UPDATE "conflict_alerts" SET "recipient_role" = 'permit-receiver' WHERE "recipient_role" = 'job-issuer';
UPDATE "conflict_alerts" SET "recipient_role" = 'permit-approver' WHERE "recipient_role" = 'hod';
UPDATE "conflict_alerts" SET "recipient_role" = 'permit-operator' WHERE "recipient_role" = 'operator';

UPDATE "approval_delegations" SET "role" = 'permit-receiver' WHERE "role" = 'job-issuer';
UPDATE "approval_delegations" SET "role" = 'permit-approver' WHERE "role" = 'hod';
UPDATE "approval_delegations" SET "role" = 'permit-operator' WHERE "role" = 'operator';

ALTER TABLE "lototo_assignments" ENABLE TRIGGER lototo_assignments_plan_locked;

ALTER TABLE "lototo_assignments"
  ADD CONSTRAINT "lototo_assignments_role_check"
  CHECK ("role" IN ('permit-operator', 'safety-officer', 'permit-approver'));
