-- PUS-243 / SP-09.01 — Workflow template configurability + reject/edit rules
-- FR-PTW-013–018, FR-PTW-024–027 (schema foundations)

CREATE TABLE IF NOT EXISTS "approval_workflow_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(128) NOT NULL,
  "description" text,
  "permit_type_id" uuid,
  "is_default" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "resubmit_mode" varchar(32) DEFAULT 'restart_from_stage_1' NOT NULL,
  CONSTRAINT "approval_workflow_templates_resubmit_mode_check"
    CHECK ("resubmit_mode" IN ('restart_from_stage_1', 'resume_from_rejecting_stage'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_workflow_templates_tenant_code_unique"
  ON "approval_workflow_templates" ("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "approval_workflow_templates_tenant_id_idx"
  ON "approval_workflow_templates" ("tenant_id");
CREATE INDEX IF NOT EXISTS "approval_workflow_templates_tenant_type_idx"
  ON "approval_workflow_templates" ("tenant_id", "permit_type_id");

ALTER TABLE "permit_types"
  ADD COLUMN IF NOT EXISTS "risk_classification" varchar(16) DEFAULT 'medium' NOT NULL;

ALTER TABLE "permit_types" DROP CONSTRAINT IF EXISTS "permit_types_risk_classification_check";
ALTER TABLE "permit_types" ADD CONSTRAINT "permit_types_risk_classification_check"
  CHECK ("risk_classification" IN ('low', 'medium', 'high'));

ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "risk_level" varchar(16);

ALTER TABLE "permits" DROP CONSTRAINT IF EXISTS "permits_risk_level_check";
ALTER TABLE "permits" ADD CONSTRAINT "permits_risk_level_check"
  CHECK ("risk_level" IS NULL OR "risk_level" IN ('low', 'medium', 'high'));

ALTER TABLE "workflow_steps"
  ADD COLUMN IF NOT EXISTS "template_id" uuid,
  ADD COLUMN IF NOT EXISTS "org_scope" varchar(64) DEFAULT 'same_department' NOT NULL,
  ADD COLUMN IF NOT EXISTS "parallel_group" varchar(64),
  ADD COLUMN IF NOT EXISTS "quorum_mode" varchar(32) DEFAULT 'all' NOT NULL,
  ADD COLUMN IF NOT EXISTS "condition" jsonb,
  ADD COLUMN IF NOT EXISTS "min_risk_level" varchar(16),
  ADD COLUMN IF NOT EXISTS "sla_minutes" integer,
  ADD COLUMN IF NOT EXISTS "escalation_fallback_roles" jsonb;

ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "workflow_steps_quorum_mode_check";
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_quorum_mode_check"
  CHECK ("quorum_mode" IN ('all', 'first'));

ALTER TABLE "workflow_steps" DROP CONSTRAINT IF EXISTS "workflow_steps_min_risk_level_check";
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_min_risk_level_check"
  CHECK ("min_risk_level" IS NULL OR "min_risk_level" IN ('low', 'medium', 'high'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workflow_steps_template_id_fk'
  ) THEN
    ALTER TABLE "workflow_steps"
      ADD CONSTRAINT "workflow_steps_template_id_fk"
      FOREIGN KEY ("template_id") REFERENCES "approval_workflow_templates"("id") ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE "workflow_assignments"
  ADD COLUMN IF NOT EXISTS "sla_due_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "sla_paused_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "escalation_level" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "parallel_group" varchar(64);

ALTER TABLE "permit_approvals"
  ADD COLUMN IF NOT EXISTS "reason_code" varchar(64),
  ADD COLUMN IF NOT EXISTS "on_behalf_of" uuid;

ALTER TABLE "approval_history" DROP CONSTRAINT IF EXISTS "approval_history_action_check";
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_action_check"
  CHECK ("action" IN (
    'submitted',
    'approved',
    'rejected',
    'deferred',
    'stage_advanced',
    'resubmitted',
    'hod_initial_review',
    'supervisor_cosign',
    'workflow_restarted_core_edit',
    'escalated',
    'blocked'
  ));
