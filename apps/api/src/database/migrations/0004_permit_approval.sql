ALTER TABLE "permits" DROP CONSTRAINT IF EXISTS "permits_status_check";
ALTER TABLE "permits" ADD CONSTRAINT "permits_status_check"
  CHECK ("status" IN ('draft', 'pending_approval', 'approved', 'rejected', 'deferred'));

CREATE TABLE IF NOT EXISTS "workflow_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_type_id" uuid,
  "step_sequence" integer NOT NULL,
  "name" varchar(128) NOT NULL,
  "approver_role" varchar(64) NOT NULL,
  "comment_required_on_approve" boolean DEFAULT false NOT NULL,
  "comment_required_on_reject" boolean DEFAULT true NOT NULL,
  "comment_required_on_defer" boolean DEFAULT true NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflow_steps_tenant_id_idx"
  ON "workflow_steps" ("tenant_id");
CREATE INDEX IF NOT EXISTS "workflow_steps_tenant_permit_type_idx"
  ON "workflow_steps" ("tenant_id", "permit_type_id");
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_steps_tenant_default_sequence_unique"
  ON "workflow_steps" ("tenant_id", "step_sequence")
  WHERE "permit_type_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_steps_tenant_type_sequence_unique"
  ON "workflow_steps" ("tenant_id", "permit_type_id", "step_sequence")
  WHERE "permit_type_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "workflow_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL,
  "workflow_step_id" uuid NOT NULL,
  "assignee_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "workflow_assignments_status_check"
    CHECK ("status" IN ('pending', 'active', 'completed', 'skipped')),
  CONSTRAINT "workflow_assignments_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "workflow_assignments_workflow_step_id_workflow_steps_id_fk"
    FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_assignments_permit_step_unique"
  ON "workflow_assignments" ("permit_id", "workflow_step_id");
CREATE INDEX IF NOT EXISTS "workflow_assignments_permit_id_idx"
  ON "workflow_assignments" ("permit_id");
CREATE INDEX IF NOT EXISTS "workflow_assignments_assignee_status_idx"
  ON "workflow_assignments" ("assignee_id", "status");
CREATE INDEX IF NOT EXISTS "workflow_assignments_workflow_step_id_idx"
  ON "workflow_assignments" ("workflow_step_id");

CREATE TABLE IF NOT EXISTS "permit_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL,
  "workflow_step_id" uuid NOT NULL,
  "workflow_assignment_id" uuid,
  "decision" varchar(32) NOT NULL,
  "comment" text,
  "decided_by" uuid NOT NULL,
  "decided_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "permit_approvals_decision_check"
    CHECK ("decision" IN ('approve', 'reject', 'defer')),
  CONSTRAINT "permit_approvals_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_approvals_workflow_step_id_workflow_steps_id_fk"
    FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE RESTRICT,
  CONSTRAINT "permit_approvals_workflow_assignment_id_workflow_assignments_id_fk"
    FOREIGN KEY ("workflow_assignment_id") REFERENCES "workflow_assignments"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_approvals_permit_step_unique"
  ON "permit_approvals" ("permit_id", "workflow_step_id");
CREATE INDEX IF NOT EXISTS "permit_approvals_permit_id_idx"
  ON "permit_approvals" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_approvals_decided_by_idx"
  ON "permit_approvals" ("decided_by");

CREATE TABLE IF NOT EXISTS "approval_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "permit_id" uuid NOT NULL,
  "permit_approval_id" uuid,
  "workflow_step_id" uuid,
  "action" varchar(64) NOT NULL,
  "from_status" varchar(32),
  "to_status" varchar(32),
  "actor_id" uuid NOT NULL,
  "comment" text,
  "metadata" jsonb,
  CONSTRAINT "approval_history_action_check"
    CHECK ("action" IN ('submitted', 'approved', 'rejected', 'deferred', 'stage_advanced', 'resubmitted')),
  CONSTRAINT "approval_history_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "approval_history_permit_approval_id_permit_approvals_id_fk"
    FOREIGN KEY ("permit_approval_id") REFERENCES "permit_approvals"("id") ON DELETE SET NULL,
  CONSTRAINT "approval_history_workflow_step_id_workflow_steps_id_fk"
    FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "approval_history_permit_id_idx"
  ON "approval_history" ("permit_id");
CREATE INDEX IF NOT EXISTS "approval_history_permit_created_at_idx"
  ON "approval_history" ("permit_id", "created_at");
CREATE INDEX IF NOT EXISTS "approval_history_actor_id_idx"
  ON "approval_history" ("actor_id");

CREATE OR REPLACE FUNCTION prevent_approval_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'approval_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS approval_history_immutable ON "approval_history";
CREATE TRIGGER approval_history_immutable
  BEFORE UPDATE OR DELETE ON "approval_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_approval_history_mutation();
