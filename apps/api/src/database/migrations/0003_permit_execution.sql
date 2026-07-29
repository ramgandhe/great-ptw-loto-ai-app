ALTER TABLE "permits" DROP CONSTRAINT IF EXISTS "permits_status_check";
ALTER TABLE "permits" ADD CONSTRAINT "permits_status_check"
  CHECK ("status" IN (
    'draft',
    'pending_approval',
    'approved',
    'active',
    'suspended',
    'pending_closure',
    'closed',
    'expired',
    'rejected',
    'deferred'
  ));

CREATE TABLE IF NOT EXISTS "permit_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "activated_at" timestamptz NOT NULL,
  "activated_by" uuid NOT NULL,
  "suspended_at" timestamptz,
  "suspended_by" uuid,
  "suspension_reason" text,
  "resumed_at" timestamptz,
  "resumed_by" uuid,
  CONSTRAINT "permit_executions_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "public"."permits"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_executions_permit_id_unique"
  ON "permit_executions" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_executions_tenant_id_idx"
  ON "permit_executions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "permit_executions_tenant_permit_idx"
  ON "permit_executions" ("tenant_id", "permit_id");

CREATE TABLE IF NOT EXISTS "permit_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "summary" text NOT NULL,
  "recorded_by" uuid NOT NULL,
  "recorded_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "permit_progress_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "public"."permits"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "permit_progress_tenant_id_idx"
  ON "permit_progress" ("tenant_id");
CREATE INDEX IF NOT EXISTS "permit_progress_permit_recorded_idx"
  ON "permit_progress" ("permit_id", "recorded_at");

CREATE TABLE IF NOT EXISTS "permit_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "progress_id" uuid,
  "file_name" varchar(255) NOT NULL,
  "content_type" varchar(128) NOT NULL,
  "file_size" bigint NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL,
  "comment" text,
  "uploaded_by" uuid NOT NULL,
  CONSTRAINT "permit_evidence_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "public"."permits"("id") ON DELETE cascade,
  CONSTRAINT "permit_evidence_progress_id_permit_progress_id_fk"
    FOREIGN KEY ("progress_id") REFERENCES "public"."permit_progress"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "permit_evidence_tenant_id_idx"
  ON "permit_evidence" ("tenant_id");
CREATE INDEX IF NOT EXISTS "permit_evidence_permit_id_idx"
  ON "permit_evidence" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_evidence_progress_id_idx"
  ON "permit_evidence" ("progress_id");

CREATE TABLE IF NOT EXISTS "permit_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "from_status" varchar(32) NOT NULL,
  "to_status" varchar(32) NOT NULL,
  "reason" text,
  "changed_by" uuid NOT NULL,
  "changed_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "permit_status_history_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "public"."permits"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "permit_status_history_tenant_id_idx"
  ON "permit_status_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "permit_status_history_permit_changed_idx"
  ON "permit_status_history" ("permit_id", "changed_at");

CREATE OR REPLACE FUNCTION prevent_permit_status_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'permit_status_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_status_history_immutable ON "permit_status_history";
CREATE TRIGGER permit_status_history_immutable
  BEFORE UPDATE OR DELETE ON "permit_status_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_permit_status_history_mutation();
