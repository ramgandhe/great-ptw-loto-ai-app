ALTER TABLE "simops_conflicts" DROP CONSTRAINT IF EXISTS "simops_conflicts_status_check";
ALTER TABLE "simops_conflicts"
  ADD CONSTRAINT "simops_conflicts_status_check"
  CHECK ("status" IN ('open', 'assessed', 'mitigation_planned', 'approved', 'rejected'));

UPDATE "simops_conflicts"
SET "status" = 'approved'
WHERE "status" = 'resolved';

CREATE TABLE IF NOT EXISTS "conflict_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "assessed_severity" varchar(16) NOT NULL,
  "risk_summary" text NOT NULL,
  "assessed_by" uuid NOT NULL,
  "assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "conflict_assessments_conflict_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE,
  CONSTRAINT "conflict_assessments_severity_check"
    CHECK ("assessed_severity" IN ('low', 'medium', 'high'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "conflict_assessments_conflict_id_unique"
  ON "conflict_assessments" ("conflict_id");
CREATE INDEX IF NOT EXISTS "conflict_assessments_tenant_id_idx"
  ON "conflict_assessments" ("tenant_id");

CREATE TABLE IF NOT EXISTS "mitigation_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "assessment_id" uuid NOT NULL,
  "plan_summary" text NOT NULL,
  "actions" jsonb,
  CONSTRAINT "mitigation_plans_conflict_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE,
  CONSTRAINT "mitigation_plans_assessment_id_fk"
    FOREIGN KEY ("assessment_id") REFERENCES "conflict_assessments"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "mitigation_plans_conflict_id_unique"
  ON "mitigation_plans" ("conflict_id");
CREATE INDEX IF NOT EXISTS "mitigation_plans_tenant_id_idx"
  ON "mitigation_plans" ("tenant_id");

CREATE TABLE IF NOT EXISTS "conflict_resolutions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "outcome" varchar(16) NOT NULL,
  "comments" text NOT NULL,
  "resolved_by" uuid NOT NULL,
  "resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "conflict_resolutions_conflict_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE,
  CONSTRAINT "conflict_resolutions_outcome_check"
    CHECK ("outcome" IN ('approved', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "conflict_resolutions_conflict_id_unique"
  ON "conflict_resolutions" ("conflict_id");
CREATE INDEX IF NOT EXISTS "conflict_resolutions_tenant_id_idx"
  ON "conflict_resolutions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "conflict_resolutions_outcome_idx"
  ON "conflict_resolutions" ("outcome");

CREATE TABLE IF NOT EXISTS "conflict_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "action" varchar(64) NOT NULL,
  "actor_user_id" uuid,
  "metadata" jsonb,
  CONSTRAINT "conflict_history_conflict_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "conflict_history_conflict_id_idx"
  ON "conflict_history" ("conflict_id");
CREATE INDEX IF NOT EXISTS "conflict_history_tenant_id_idx"
  ON "conflict_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "conflict_history_action_idx"
  ON "conflict_history" ("action");
