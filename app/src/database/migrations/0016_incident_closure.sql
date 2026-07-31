CREATE TABLE IF NOT EXISTS "incident_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL,
  "investigation_id" uuid NOT NULL,
  "verified_by" uuid NOT NULL,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "comments" text DEFAULT '' NOT NULL,
  "corrective_actions_confirmed" boolean DEFAULT false NOT NULL,
  "preventive_actions_reviewed" boolean DEFAULT false NOT NULL,
  CONSTRAINT "incident_verifications_incident_id_fk"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT,
  CONSTRAINT "incident_verifications_investigation_id_fk"
    FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "incident_verifications_incident_id_unique"
  ON "incident_verifications" ("incident_id");
CREATE INDEX IF NOT EXISTS "incident_verifications_tenant_id_idx"
  ON "incident_verifications" ("tenant_id");
CREATE INDEX IF NOT EXISTS "incident_verifications_investigation_id_idx"
  ON "incident_verifications" ("investigation_id");

CREATE TABLE IF NOT EXISTS "incident_closures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL,
  "verification_id" uuid NOT NULL,
  "closed_by" uuid NOT NULL,
  "closed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "comments" text DEFAULT '' NOT NULL,
  CONSTRAINT "incident_closures_incident_id_fk"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT,
  CONSTRAINT "incident_closures_verification_id_fk"
    FOREIGN KEY ("verification_id") REFERENCES "incident_verifications"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "incident_closures_incident_id_unique"
  ON "incident_closures" ("incident_id");
CREATE INDEX IF NOT EXISTS "incident_closures_tenant_id_idx"
  ON "incident_closures" ("tenant_id");
CREATE INDEX IF NOT EXISTS "incident_closures_verification_id_idx"
  ON "incident_closures" ("verification_id");

CREATE TABLE IF NOT EXISTS "incident_archive" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL,
  "reference" varchar(64) NOT NULL,
  "incident_type" varchar(32) NOT NULL,
  "title" varchar(255) NOT NULL,
  "closed_at" timestamp with time zone NOT NULL,
  "archived_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archived_by" uuid NOT NULL,
  "snapshot" jsonb NOT NULL,
  CONSTRAINT "incident_archive_incident_id_fk"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "incident_archive_incident_id_unique"
  ON "incident_archive" ("incident_id");
CREATE UNIQUE INDEX IF NOT EXISTS "incident_archive_tenant_reference_unique"
  ON "incident_archive" ("tenant_id", "reference");
CREATE INDEX IF NOT EXISTS "incident_archive_tenant_id_idx"
  ON "incident_archive" ("tenant_id");
CREATE INDEX IF NOT EXISTS "incident_archive_closed_at_idx"
  ON "incident_archive" ("closed_at");
CREATE INDEX IF NOT EXISTS "incident_archive_tenant_type_idx"
  ON "incident_archive" ("tenant_id", "incident_type");

CREATE OR REPLACE FUNCTION prevent_incident_verification_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'incident_verifications records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incident_verifications_immutable ON "incident_verifications";
CREATE TRIGGER incident_verifications_immutable
  BEFORE UPDATE OR DELETE ON "incident_verifications"
  FOR EACH ROW EXECUTE FUNCTION prevent_incident_verification_mutation();

CREATE OR REPLACE FUNCTION prevent_incident_closure_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'incident_closures records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incident_closures_immutable ON "incident_closures";
CREATE TRIGGER incident_closures_immutable
  BEFORE UPDATE OR DELETE ON "incident_closures"
  FOR EACH ROW EXECUTE FUNCTION prevent_incident_closure_mutation();

CREATE OR REPLACE FUNCTION prevent_incident_archive_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'incident_archive records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incident_archive_immutable ON "incident_archive";
CREATE TRIGGER incident_archive_immutable
  BEFORE UPDATE OR DELETE ON "incident_archive"
  FOR EACH ROW EXECUTE FUNCTION prevent_incident_archive_mutation();
