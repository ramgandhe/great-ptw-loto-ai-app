-- SP-04.02 Conflict Resolution (PUS-174)
-- Depends on 0010_simops_conflict_detection (simops_conflicts).

CREATE TABLE IF NOT EXISTS "conflict_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "assessed_severity" varchar(16) NOT NULL,
  "risk_summary" text,
  "findings" jsonb,
  "assessed_by" uuid NOT NULL,
  "assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  CONSTRAINT "conflict_assessments_assessed_severity_check"
    CHECK ("assessed_severity" IN ('low', 'medium', 'high')),
  CONSTRAINT "conflict_assessments_status_check"
    CHECK ("status" IN ('draft', 'completed')),
  CONSTRAINT "conflict_assessments_conflict_id_simops_conflicts_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "conflict_assessments_tenant_id_idx"
  ON "conflict_assessments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "conflict_assessments_conflict_id_idx"
  ON "conflict_assessments" ("conflict_id");
CREATE INDEX IF NOT EXISTS "conflict_assessments_conflict_assessed_at_idx"
  ON "conflict_assessments" ("conflict_id", "assessed_at");

CREATE TABLE IF NOT EXISTS "mitigation_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "assessment_id" uuid,
  "title" varchar(255) NOT NULL,
  "description" text,
  "measures" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "responsible_user_id" uuid,
  "due_at" timestamp with time zone,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "evidence_storage_bucket" varchar(128),
  "evidence_storage_key" varchar(512),
  CONSTRAINT "mitigation_plans_status_check"
    CHECK ("status" IN ('draft', 'active', 'completed', 'cancelled')),
  CONSTRAINT "mitigation_plans_conflict_id_simops_conflicts_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE,
  CONSTRAINT "mitigation_plans_assessment_id_conflict_assessments_id_fk"
    FOREIGN KEY ("assessment_id") REFERENCES "conflict_assessments"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "mitigation_plans_tenant_id_idx"
  ON "mitigation_plans" ("tenant_id");
CREATE INDEX IF NOT EXISTS "mitigation_plans_conflict_id_idx"
  ON "mitigation_plans" ("conflict_id");
CREATE INDEX IF NOT EXISTS "mitigation_plans_assessment_id_idx"
  ON "mitigation_plans" ("assessment_id");
CREATE INDEX IF NOT EXISTS "mitigation_plans_tenant_status_idx"
  ON "mitigation_plans" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "conflict_resolutions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "decision" varchar(16) NOT NULL,
  "comments" text NOT NULL,
  "decided_by" uuid NOT NULL,
  "decided_at" timestamp with time zone DEFAULT now() NOT NULL,
  "mitigation_plan_id" uuid,
  CONSTRAINT "conflict_resolutions_decision_check"
    CHECK ("decision" IN ('approved', 'rejected')),
  CONSTRAINT "conflict_resolutions_conflict_id_simops_conflicts_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE RESTRICT,
  CONSTRAINT "conflict_resolutions_mitigation_plan_id_mitigation_plans_id_fk"
    FOREIGN KEY ("mitigation_plan_id") REFERENCES "mitigation_plans"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "conflict_resolutions_conflict_id_unique"
  ON "conflict_resolutions" ("conflict_id");
CREATE INDEX IF NOT EXISTS "conflict_resolutions_tenant_id_idx"
  ON "conflict_resolutions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "conflict_resolutions_tenant_decision_idx"
  ON "conflict_resolutions" ("tenant_id", "decision");
CREATE INDEX IF NOT EXISTS "conflict_resolutions_decided_at_idx"
  ON "conflict_resolutions" ("decided_at");

CREATE TABLE IF NOT EXISTS "conflict_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "action" varchar(64) NOT NULL,
  "entity_type" varchar(64) NOT NULL,
  "entity_id" uuid,
  "actor_id" uuid NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb,
  CONSTRAINT "conflict_history_action_check"
    CHECK ("action" IN (
      'detected',
      'assessed',
      'mitigation_created',
      'mitigation_updated',
      'approved',
      'rejected',
      'escalated',
      'notification_sent'
    )),
  CONSTRAINT "conflict_history_conflict_id_simops_conflicts_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "conflict_history_tenant_id_idx"
  ON "conflict_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "conflict_history_conflict_id_idx"
  ON "conflict_history" ("conflict_id");
CREATE INDEX IF NOT EXISTS "conflict_history_tenant_occurred_at_idx"
  ON "conflict_history" ("tenant_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "conflict_history_conflict_occurred_at_idx"
  ON "conflict_history" ("conflict_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "conflict_history_action_idx"
  ON "conflict_history" ("action");

-- Tenant isolation: child rows must match the parent conflict tenant.
CREATE OR REPLACE FUNCTION enforce_simops_resolution_tenant()
RETURNS trigger AS $$
DECLARE
  conflict_tenant_id uuid;
BEGIN
  SELECT "tenant_id" INTO conflict_tenant_id
  FROM "simops_conflicts"
  WHERE "id" = NEW."conflict_id";

  IF conflict_tenant_id IS NULL THEN
    RAISE EXCEPTION 'referenced simops_conflict % does not exist', NEW."conflict_id";
  END IF;

  IF conflict_tenant_id IS DISTINCT FROM NEW."tenant_id" THEN
    RAISE EXCEPTION '% tenant_id must match its simops_conflict tenant', TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conflict_assessments_tenant_match ON "conflict_assessments";
CREATE TRIGGER conflict_assessments_tenant_match
  BEFORE INSERT OR UPDATE OF "tenant_id", "conflict_id" ON "conflict_assessments"
  FOR EACH ROW EXECUTE FUNCTION enforce_simops_resolution_tenant();

DROP TRIGGER IF EXISTS mitigation_plans_tenant_match ON "mitigation_plans";
CREATE TRIGGER mitigation_plans_tenant_match
  BEFORE INSERT OR UPDATE OF "tenant_id", "conflict_id" ON "mitigation_plans"
  FOR EACH ROW EXECUTE FUNCTION enforce_simops_resolution_tenant();

DROP TRIGGER IF EXISTS conflict_resolutions_tenant_match ON "conflict_resolutions";
CREATE TRIGGER conflict_resolutions_tenant_match
  BEFORE INSERT OR UPDATE OF "tenant_id", "conflict_id" ON "conflict_resolutions"
  FOR EACH ROW EXECUTE FUNCTION enforce_simops_resolution_tenant();

DROP TRIGGER IF EXISTS conflict_history_tenant_match ON "conflict_history";
CREATE TRIGGER conflict_history_tenant_match
  BEFORE INSERT OR UPDATE OF "tenant_id", "conflict_id" ON "conflict_history"
  FOR EACH ROW EXECUTE FUNCTION enforce_simops_resolution_tenant();

-- BR-SIM-011: historical conflict records remain immutable.
CREATE OR REPLACE FUNCTION prevent_conflict_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'conflict_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conflict_history_immutable ON "conflict_history";
CREATE TRIGGER conflict_history_immutable
  BEFORE UPDATE OR DELETE ON "conflict_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_conflict_history_mutation();

-- Final resolution decisions are immutable once recorded (BR-SIM-010).
CREATE OR REPLACE FUNCTION prevent_conflict_resolution_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'conflict_resolutions records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS conflict_resolutions_immutable ON "conflict_resolutions";
CREATE TRIGGER conflict_resolutions_immutable
  BEFORE UPDATE OR DELETE ON "conflict_resolutions"
  FOR EACH ROW EXECUTE FUNCTION prevent_conflict_resolution_mutation();
