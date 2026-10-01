CREATE TABLE IF NOT EXISTS "simops_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'review_required' NOT NULL,
  "severity" varchar(16) NOT NULL,
  "summary" varchar(512) NOT NULL,
  "fingerprint" varchar(256) NOT NULL,
  "detected_at" timestamptz DEFAULT now() NOT NULL,
  "resolved_at" timestamptz,
  "resolved_by" uuid
);

CREATE INDEX IF NOT EXISTS "simops_cases_tenant_id_idx" ON "simops_cases" ("tenant_id");
CREATE INDEX IF NOT EXISTS "simops_cases_tenant_status_idx" ON "simops_cases" ("tenant_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "simops_cases_tenant_fingerprint_unique" ON "simops_cases" ("tenant_id", "fingerprint");

CREATE TABLE IF NOT EXISTS "simops_case_permits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "simops_cases"("id") ON DELETE CASCADE,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "decision" varchar(32),
  "comments" text
);

CREATE UNIQUE INDEX IF NOT EXISTS "simops_case_permits_case_permit_unique" ON "simops_case_permits" ("case_id", "permit_id");
CREATE INDEX IF NOT EXISTS "simops_case_permits_permit_id_idx" ON "simops_case_permits" ("permit_id");
CREATE INDEX IF NOT EXISTS "simops_case_permits_case_id_idx" ON "simops_case_permits" ("case_id");

CREATE TABLE IF NOT EXISTS "simops_case_interactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "simops_cases"("id") ON DELETE CASCADE,
  "permit_id_a" uuid NOT NULL,
  "permit_id_b" uuid NOT NULL,
  "conflict_type" varchar(32) NOT NULL,
  "severity" varchar(16) NOT NULL,
  "summary" varchar(512) NOT NULL,
  "details" jsonb
);

CREATE INDEX IF NOT EXISTS "simops_case_interactions_case_id_idx" ON "simops_case_interactions" ("case_id");

CREATE TABLE IF NOT EXISTS "simops_case_controls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "simops_cases"("id") ON DELETE CASCADE,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "control_text" text NOT NULL,
  "responsible_user_id" uuid NOT NULL,
  "comments" text
);

CREATE INDEX IF NOT EXISTS "simops_case_controls_case_id_idx" ON "simops_case_controls" ("case_id");

CREATE TABLE IF NOT EXISTS "simops_case_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "simops_cases"("id") ON DELETE CASCADE,
  "action" varchar(64) NOT NULL,
  "actor_user_id" uuid,
  "metadata" jsonb
);

CREATE INDEX IF NOT EXISTS "simops_case_history_case_id_idx" ON "simops_case_history" ("case_id");
