ALTER TABLE "permits" DROP CONSTRAINT IF EXISTS "permits_status_check";
ALTER TABLE "permits" ADD CONSTRAINT "permits_status_check"
  CHECK ("status" IN (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'deferred',
    'active',
    'suspended',
    'closed'
  ));

ALTER TABLE "permit_status_history" DROP CONSTRAINT IF EXISTS "permit_status_history_action_check";
ALTER TABLE "permit_status_history" ADD CONSTRAINT "permit_status_history_action_check"
  CHECK ("action" IN ('activated', 'suspended', 'resumed', 'verified', 'closed'));

CREATE TABLE IF NOT EXISTS "permit_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "permit_id" uuid NOT NULL,
  "verified_by" uuid NOT NULL,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "comment" text,
  "checklist" jsonb NOT NULL,
  CONSTRAINT "permit_verifications_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_verifications_permit_id_unique"
  ON "permit_verifications" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_verifications_verified_by_idx"
  ON "permit_verifications" ("verified_by");

CREATE TABLE IF NOT EXISTS "permit_closures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "permit_id" uuid NOT NULL,
  "closed_by" uuid NOT NULL,
  "closed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "actual_end_at" timestamp with time zone NOT NULL,
  "comment" text,
  CONSTRAINT "permit_closures_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_closures_permit_id_unique"
  ON "permit_closures" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_closures_closed_by_idx"
  ON "permit_closures" ("closed_by");

CREATE TABLE IF NOT EXISTS "permit_archive" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "reference" varchar(32),
  "closed_at" timestamp with time zone NOT NULL,
  "closed_by" uuid NOT NULL,
  "archived_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "permit_archive_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_archive_permit_id_unique"
  ON "permit_archive" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_archive_tenant_id_idx"
  ON "permit_archive" ("tenant_id");
CREATE INDEX IF NOT EXISTS "permit_archive_tenant_closed_at_idx"
  ON "permit_archive" ("tenant_id", "closed_at");
CREATE INDEX IF NOT EXISTS "permit_archive_tenant_title_idx"
  ON "permit_archive" ("tenant_id", "title");
CREATE INDEX IF NOT EXISTS "permit_archive_tenant_reference_idx"
  ON "permit_archive" ("tenant_id", "reference");

CREATE TABLE IF NOT EXISTS "audit_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "permit_id" uuid NOT NULL,
  "action" varchar(64) NOT NULL,
  "actor_id" uuid NOT NULL,
  "comment" text,
  "metadata" jsonb,
  CONSTRAINT "audit_history_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "audit_history_permit_id_idx"
  ON "audit_history" ("permit_id");
CREATE INDEX IF NOT EXISTS "audit_history_permit_created_at_idx"
  ON "audit_history" ("permit_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_history_actor_id_idx"
  ON "audit_history" ("actor_id");

CREATE OR REPLACE FUNCTION prevent_permit_verification_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'permit_verifications records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_verifications_immutable ON "permit_verifications";
CREATE TRIGGER permit_verifications_immutable
  BEFORE UPDATE OR DELETE ON "permit_verifications"
  FOR EACH ROW EXECUTE FUNCTION prevent_permit_verification_mutation();

CREATE OR REPLACE FUNCTION prevent_permit_closure_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'permit_closures records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_closures_immutable ON "permit_closures";
CREATE TRIGGER permit_closures_immutable
  BEFORE UPDATE OR DELETE ON "permit_closures"
  FOR EACH ROW EXECUTE FUNCTION prevent_permit_closure_mutation();

CREATE OR REPLACE FUNCTION prevent_permit_archive_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'permit_archive records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_archive_immutable ON "permit_archive";
CREATE TRIGGER permit_archive_immutable
  BEFORE UPDATE OR DELETE ON "permit_archive"
  FOR EACH ROW EXECUTE FUNCTION prevent_permit_archive_mutation();

CREATE OR REPLACE FUNCTION prevent_audit_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_history_immutable ON "audit_history";
CREATE TRIGGER audit_history_immutable
  BEFORE UPDATE OR DELETE ON "audit_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_history_mutation();

CREATE OR REPLACE FUNCTION enforce_permit_verification_on_active()
RETURNS trigger AS $$
DECLARE
  permit_status varchar(32);
BEGIN
  SELECT "status" INTO permit_status FROM "permits" WHERE "id" = NEW."permit_id";

  IF permit_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'permit_verifications requires permit status active, got %', permit_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_verifications_requires_active ON "permit_verifications";
CREATE TRIGGER permit_verifications_requires_active
  BEFORE INSERT ON "permit_verifications"
  FOR EACH ROW EXECUTE FUNCTION enforce_permit_verification_on_active();

CREATE OR REPLACE FUNCTION enforce_permit_closure_requirements()
RETURNS trigger AS $$
DECLARE
  permit_status varchar(32);
  verification_count integer;
BEGIN
  SELECT "status" INTO permit_status FROM "permits" WHERE "id" = NEW."permit_id";

  IF permit_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'permit_closures requires permit status active, got %', permit_status;
  END IF;

  SELECT COUNT(*) INTO verification_count
  FROM "permit_verifications"
  WHERE "permit_id" = NEW."permit_id";

  IF verification_count = 0 THEN
    RAISE EXCEPTION 'permit_closures requires prior verification';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_closures_requires_verification ON "permit_closures";
CREATE TRIGGER permit_closures_requires_verification
  BEFORE INSERT ON "permit_closures"
  FOR EACH ROW EXECUTE FUNCTION enforce_permit_closure_requirements();

CREATE OR REPLACE FUNCTION prevent_closed_permit_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'closed' THEN
    RAISE EXCEPTION 'closed permits are read-only';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permits_closed_readonly ON "permits";
CREATE TRIGGER permits_closed_readonly
  BEFORE UPDATE ON "permits"
  FOR EACH ROW EXECUTE FUNCTION prevent_closed_permit_mutation();
