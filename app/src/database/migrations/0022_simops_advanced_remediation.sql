-- PUS-246 / FR-SIM-011–021 — SIMOPS advanced detection & resolution remediation

ALTER TABLE "locations"
  ADD COLUMN IF NOT EXISTS "adjacency_zone" varchar(64);

CREATE TABLE IF NOT EXISTS "location_adjacencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  "adjacent_location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  "zone_key" varchar(64),
  CONSTRAINT "location_adjacencies_distinct_check"
    CHECK ("location_id" <> "adjacent_location_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "location_adjacencies_tenant_pair_unique"
  ON "location_adjacencies" ("tenant_id", "location_id", "adjacent_location_id");
CREATE INDEX IF NOT EXISTS "location_adjacencies_tenant_id_idx"
  ON "location_adjacencies" ("tenant_id");

CREATE TABLE IF NOT EXISTS "hazard_interaction_matrix" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "hazard_code_a" varchar(64) NOT NULL,
  "hazard_code_b" varchar(64) NOT NULL,
  "severity" varchar(16) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "hazard_interaction_matrix_severity_check"
    CHECK ("severity" IN ('low', 'medium', 'high'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "hazard_interaction_matrix_tenant_pair_unique"
  ON "hazard_interaction_matrix" ("tenant_id", "hazard_code_a", "hazard_code_b");
CREATE INDEX IF NOT EXISTS "hazard_interaction_matrix_tenant_id_idx"
  ON "hazard_interaction_matrix" ("tenant_id");

CREATE TABLE IF NOT EXISTS "simops_tenant_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "high_escalation_hours" integer DEFAULT 4 NOT NULL,
  "conflict_arbiter_role" varchar(64) DEFAULT 'org-admin' NOT NULL,
  CONSTRAINT "simops_tenant_settings_hours_check"
    CHECK ("high_escalation_hours" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "simops_tenant_settings_tenant_unique"
  ON "simops_tenant_settings" ("tenant_id");

ALTER TABLE "simops_conflicts" DROP CONSTRAINT IF EXISTS "simops_conflicts_type_check";
ALTER TABLE "simops_conflicts"
  ADD CONSTRAINT "simops_conflicts_type_check"
  CHECK ("conflict_type" IN (
    'location', 'equipment', 'schedule', 'permit_type',
    'adjacency', 'hazard', 'energy_source'
  ));

ALTER TABLE "simops_conflicts"
  ADD COLUMN IF NOT EXISTS "frozen_permit_id" uuid REFERENCES "permits"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "requires_joint_ack" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "department_a_id" uuid,
  ADD COLUMN IF NOT EXISTS "department_b_id" uuid,
  ADD COLUMN IF NOT EXISTS "ack_user_a" uuid,
  ADD COLUMN IF NOT EXISTS "ack_user_b" uuid,
  ADD COLUMN IF NOT EXISTS "ack_at_a" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "ack_at_b" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "escalate_after" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "escalated_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "escalated_to_role" varchar(64);

CREATE INDEX IF NOT EXISTS "simops_conflicts_frozen_permit_id_idx"
  ON "simops_conflicts" ("frozen_permit_id");
CREATE INDEX IF NOT EXISTS "simops_conflicts_escalate_after_idx"
  ON "simops_conflicts" ("escalate_after");

ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "simops_hold_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "simops_hold_conflict_id" uuid;

CREATE INDEX IF NOT EXISTS "permits_simops_hold_conflict_id_idx"
  ON "permits" ("simops_hold_conflict_id");
