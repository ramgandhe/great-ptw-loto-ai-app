ALTER TABLE "permits" DROP CONSTRAINT IF EXISTS "permits_status_check";
ALTER TABLE "permits" ADD CONSTRAINT "permits_status_check"
  CHECK ("status" IN (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'deferred',
    'active',
    'suspended'
  ));

CREATE TABLE IF NOT EXISTS "permit_execution" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL,
  "activated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "activated_by" uuid NOT NULL,
  "actual_start_at" timestamp with time zone NOT NULL,
  "suspended_at" timestamp with time zone,
  "suspended_by" uuid,
  "suspension_reason" text,
  "resumed_at" timestamp with time zone,
  "resumed_by" uuid,
  CONSTRAINT "permit_execution_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_execution_permit_id_unique"
  ON "permit_execution" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_execution_activated_by_idx"
  ON "permit_execution" ("activated_by");

CREATE OR REPLACE FUNCTION enforce_permit_execution_on_approved()
RETURNS trigger AS $$
DECLARE
  permit_status varchar(32);
BEGIN
  SELECT "status" INTO permit_status FROM "permits" WHERE "id" = NEW."permit_id";

  IF permit_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'permit_execution requires permit status approved, got %', permit_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_execution_requires_approved ON "permit_execution";
CREATE TRIGGER permit_execution_requires_approved
  BEFORE INSERT ON "permit_execution"
  FOR EACH ROW EXECUTE FUNCTION enforce_permit_execution_on_approved();

CREATE TABLE IF NOT EXISTS "permit_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "permit_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "summary" text NOT NULL,
  "recorded_by" uuid NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb,
  CONSTRAINT "permit_progress_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_progress_execution_id_permit_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "permit_execution"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "permit_progress_permit_id_idx"
  ON "permit_progress" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_progress_execution_id_idx"
  ON "permit_progress" ("execution_id");
CREATE INDEX IF NOT EXISTS "permit_progress_permit_recorded_at_idx"
  ON "permit_progress" ("permit_id", "recorded_at");

CREATE TABLE IF NOT EXISTS "permit_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "progress_id" uuid,
  "file_name" varchar(255) NOT NULL,
  "content_type" varchar(128) NOT NULL,
  "file_size" bigint NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL,
  "checksum" varchar(128),
  "comment" text,
  "uploaded_by" uuid NOT NULL,
  CONSTRAINT "permit_evidence_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_evidence_execution_id_permit_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "permit_execution"("id") ON DELETE RESTRICT,
  CONSTRAINT "permit_evidence_progress_id_permit_progress_id_fk"
    FOREIGN KEY ("progress_id") REFERENCES "permit_progress"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "permit_evidence_permit_id_idx"
  ON "permit_evidence" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_evidence_execution_id_idx"
  ON "permit_evidence" ("execution_id");
CREATE INDEX IF NOT EXISTS "permit_evidence_progress_id_idx"
  ON "permit_evidence" ("progress_id");

CREATE TABLE IF NOT EXISTS "permit_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "permit_id" uuid NOT NULL,
  "execution_id" uuid,
  "action" varchar(64) NOT NULL,
  "from_status" varchar(32),
  "to_status" varchar(32),
  "actor_id" uuid NOT NULL,
  "comment" text,
  "metadata" jsonb,
  CONSTRAINT "permit_status_history_action_check"
    CHECK ("action" IN ('activated', 'suspended', 'resumed')),
  CONSTRAINT "permit_status_history_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_status_history_execution_id_permit_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "permit_execution"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "permit_status_history_permit_id_idx"
  ON "permit_status_history" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_status_history_permit_created_at_idx"
  ON "permit_status_history" ("permit_id", "created_at");
CREATE INDEX IF NOT EXISTS "permit_status_history_actor_id_idx"
  ON "permit_status_history" ("actor_id");

CREATE OR REPLACE FUNCTION prevent_permit_progress_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'permit_progress records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_progress_immutable ON "permit_progress";
CREATE TRIGGER permit_progress_immutable
  BEFORE UPDATE OR DELETE ON "permit_progress"
  FOR EACH ROW EXECUTE FUNCTION prevent_permit_progress_mutation();

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

CREATE OR REPLACE FUNCTION prevent_permit_evidence_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'permit_evidence records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_evidence_immutable ON "permit_evidence";
CREATE TRIGGER permit_evidence_immutable
  BEFORE UPDATE OR DELETE ON "permit_evidence"
  FOR EACH ROW EXECUTE FUNCTION prevent_permit_evidence_mutation();
