CREATE TABLE IF NOT EXISTS "incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "reference" varchar(64) NOT NULL,
  "incident_type" varchar(32) NOT NULL,
  "severity_path" varchar(32) DEFAULT 'near_miss' NOT NULL,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "location_description" text DEFAULT '' NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "priority" varchar(32) DEFAULT 'medium' NOT NULL,
  "reported_by" uuid NOT NULL,
  "submitted_by" uuid,
  "submitted_at" timestamp with time zone,
  "plant_id" uuid,
  "location_id" uuid,
  "workstation_id" uuid,
  CONSTRAINT "incidents_type_check"
    CHECK ("incident_type" IN ('incident', 'near_miss', 'unsafe_condition')),
  CONSTRAINT "incidents_severity_path_check"
    CHECK ("severity_path" IN ('near_miss', 'accident')),
  CONSTRAINT "incidents_status_check"
    CHECK ("status" IN ('draft', 'open', 'investigating', 'pending_verification', 'verified', 'closed')),
  CONSTRAINT "incidents_priority_check"
    CHECK ("priority" IN ('low', 'medium', 'high', 'critical'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "incidents_tenant_reference_unique"
  ON "incidents" ("tenant_id", "reference");
CREATE INDEX IF NOT EXISTS "incidents_tenant_id_idx"
  ON "incidents" ("tenant_id");
CREATE INDEX IF NOT EXISTS "incidents_tenant_status_idx"
  ON "incidents" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "incidents_tenant_type_idx"
  ON "incidents" ("tenant_id", "incident_type");
CREATE INDEX IF NOT EXISTS "incidents_occurred_at_idx"
  ON "incidents" ("occurred_at");

CREATE TABLE IF NOT EXISTS "incident_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "content_type" varchar(128) NOT NULL,
  "file_size" bigint NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL,
  "checksum" varchar(128),
  "comment" text,
  "uploaded_by" uuid NOT NULL,
  CONSTRAINT "incident_evidence_incident_id_fk"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "incident_evidence_tenant_id_idx"
  ON "incident_evidence" ("tenant_id");
CREATE INDEX IF NOT EXISTS "incident_evidence_incident_id_idx"
  ON "incident_evidence" ("incident_id");
CREATE UNIQUE INDEX IF NOT EXISTS "incident_evidence_storage_key_unique"
  ON "incident_evidence" ("tenant_id", "storage_key");

CREATE TABLE IF NOT EXISTS "incident_equipment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL,
  "machinery_id" uuid NOT NULL,
  CONSTRAINT "incident_equipment_incident_id_fk"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE,
  CONSTRAINT "incident_equipment_machinery_id_fk"
    FOREIGN KEY ("machinery_id") REFERENCES "machinery_catalogue"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "incident_equipment_incident_machinery_unique"
  ON "incident_equipment" ("incident_id", "machinery_id");
CREATE INDEX IF NOT EXISTS "incident_equipment_tenant_id_idx"
  ON "incident_equipment" ("tenant_id");
CREATE INDEX IF NOT EXISTS "incident_equipment_incident_id_idx"
  ON "incident_equipment" ("incident_id");
CREATE INDEX IF NOT EXISTS "incident_equipment_machinery_id_idx"
  ON "incident_equipment" ("machinery_id");

CREATE TABLE IF NOT EXISTS "incident_permits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  CONSTRAINT "incident_permits_incident_id_fk"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE,
  CONSTRAINT "incident_permits_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "incident_permits_incident_permit_unique"
  ON "incident_permits" ("incident_id", "permit_id");
CREATE INDEX IF NOT EXISTS "incident_permits_tenant_id_idx"
  ON "incident_permits" ("tenant_id");
CREATE INDEX IF NOT EXISTS "incident_permits_incident_id_idx"
  ON "incident_permits" ("incident_id");
CREATE INDEX IF NOT EXISTS "incident_permits_permit_id_idx"
  ON "incident_permits" ("permit_id");

CREATE OR REPLACE FUNCTION prevent_submitted_incident_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'submitted incident records cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incidents_submitted_no_delete ON "incidents";
CREATE TRIGGER incidents_submitted_no_delete
  BEFORE DELETE ON "incidents"
  FOR EACH ROW EXECUTE FUNCTION prevent_submitted_incident_delete();

CREATE OR REPLACE FUNCTION prevent_closed_incident_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'closed incident records are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incidents_closed_immutable ON "incidents";
CREATE TRIGGER incidents_closed_immutable
  BEFORE UPDATE ON "incidents"
  FOR EACH ROW EXECUTE FUNCTION prevent_closed_incident_mutation();

CREATE OR REPLACE FUNCTION prevent_incident_evidence_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'incident_evidence records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incident_evidence_immutable ON "incident_evidence";
CREATE TRIGGER incident_evidence_immutable
  BEFORE UPDATE OR DELETE ON "incident_evidence"
  FOR EACH ROW EXECUTE FUNCTION prevent_incident_evidence_mutation();
