ALTER TABLE "workflow_steps"
  ADD COLUMN IF NOT EXISTS "stage_mode" varchar(32) DEFAULT 'sequential' NOT NULL,
  ADD COLUMN IF NOT EXISTS "quorum_mode" varchar(32) DEFAULT 'all' NOT NULL,
  ADD COLUMN IF NOT EXISTS "parallel_roles" jsonb,
  ADD COLUMN IF NOT EXISTS "sla_hours" integer,
  ADD COLUMN IF NOT EXISTS "step_config" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "workflow_steps_stage_mode_check";
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_stage_mode_check"
  CHECK ("stage_mode" IN ('sequential', 'parallel'));

ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "workflow_steps_quorum_mode_check";
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_quorum_mode_check"
  CHECK ("quorum_mode" IN ('all', 'first'));

ALTER TABLE "workflow_assignments"
  ADD COLUMN IF NOT EXISTS "assignment_slot" varchar(64) DEFAULT 'default' NOT NULL,
  ADD COLUMN IF NOT EXISTS "sla_deadline_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "escalation_level" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "sla_paused_at" timestamp with time zone;

DROP INDEX IF EXISTS "workflow_assignments_permit_step_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_assignments_permit_step_slot_unique"
  ON "workflow_assignments" ("permit_id", "workflow_step_id", "assignment_slot");

ALTER TABLE "permit_approvals"
  ADD COLUMN IF NOT EXISTS "reason_code" varchar(64),
  ADD COLUMN IF NOT EXISTS "decided_on_behalf_of" uuid;

DROP INDEX IF EXISTS "permit_approvals_permit_step_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "permit_approvals_assignment_unique"
  ON "permit_approvals" ("workflow_assignment_id")
  WHERE "workflow_assignment_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "approval_delegations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "delegator_id" uuid NOT NULL,
  "delegate_id" uuid NOT NULL,
  "role" varchar(64) NOT NULL,
  "valid_from" timestamp with time zone NOT NULL,
  "valid_to" timestamp with time zone NOT NULL,
  "notes" text,
  CONSTRAINT "approval_delegations_valid_range_check"
    CHECK ("valid_to" > "valid_from")
);

CREATE INDEX IF NOT EXISTS "approval_delegations_tenant_delegate_idx"
  ON "approval_delegations" ("tenant_id", "delegate_id");
CREATE INDEX IF NOT EXISTS "approval_delegations_tenant_delegator_idx"
  ON "approval_delegations" ("tenant_id", "delegator_id");

CREATE TABLE IF NOT EXISTS "approval_sla_escalations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "workflow_assignment_id" uuid NOT NULL,
  "escalation_level" integer NOT NULL,
  "fallback_role" varchar(64),
  "notified_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "approval_sla_escalations_level_check"
    CHECK ("escalation_level" BETWEEN 1 AND 3)
);

CREATE INDEX IF NOT EXISTS "approval_sla_escalations_permit_idx"
  ON "approval_sla_escalations" ("permit_id");
