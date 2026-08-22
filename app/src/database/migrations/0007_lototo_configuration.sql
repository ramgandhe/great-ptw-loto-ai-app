CREATE TABLE IF NOT EXISTS "lototo_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "workstation_id" uuid,
  "machinery_id" uuid,
  "reference" varchar(32),
  "title" varchar(255) NOT NULL,
  "description" text,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  CONSTRAINT "lototo_plans_status_check"
    CHECK ("status" IN ('draft', 'ready', 'in_execution', 'completed')),
  CONSTRAINT "lototo_plans_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "lototo_plans_workstation_id_workstation_catalogue_id_fk"
    FOREIGN KEY ("workstation_id") REFERENCES "workstation_catalogue"("id") ON DELETE RESTRICT,
  CONSTRAINT "lototo_plans_machinery_id_machinery_catalogue_id_fk"
    FOREIGN KEY ("machinery_id") REFERENCES "machinery_catalogue"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "lototo_plans_tenant_id_idx"
  ON "lototo_plans" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lototo_plans_permit_id_idx"
  ON "lototo_plans" ("permit_id");
CREATE INDEX IF NOT EXISTS "lototo_plans_tenant_status_idx"
  ON "lototo_plans" ("tenant_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "lototo_plans_tenant_reference_unique"
  ON "lototo_plans" ("tenant_id", "reference");

CREATE TABLE IF NOT EXISTS "equipment_energy_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "plan_id" uuid NOT NULL,
  "machinery_id" uuid NOT NULL,
  "energy_source_type" varchar(64) NOT NULL,
  "description" text,
  "lock_method" varchar(64),
  "tag_type" varchar(64),
  CONSTRAINT "equipment_energy_sources_plan_id_lototo_plans_id_fk"
    FOREIGN KEY ("plan_id") REFERENCES "lototo_plans"("id") ON DELETE CASCADE,
  CONSTRAINT "equipment_energy_sources_machinery_id_machinery_catalogue_id_fk"
    FOREIGN KEY ("machinery_id") REFERENCES "machinery_catalogue"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "equipment_energy_sources_plan_id_idx"
  ON "equipment_energy_sources" ("plan_id");
CREATE INDEX IF NOT EXISTS "equipment_energy_sources_machinery_id_idx"
  ON "equipment_energy_sources" ("machinery_id");
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_energy_sources_plan_machinery_type_unique"
  ON "equipment_energy_sources" ("plan_id", "machinery_id", "energy_source_type");

CREATE TABLE IF NOT EXISTS "isolation_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "plan_id" uuid NOT NULL,
  "machinery_id" uuid NOT NULL,
  "equipment_energy_source_id" uuid,
  "isolation_number" varchar(64) NOT NULL,
  "description" text,
  "verification_required" boolean DEFAULT true NOT NULL,
  CONSTRAINT "isolation_points_plan_id_lototo_plans_id_fk"
    FOREIGN KEY ("plan_id") REFERENCES "lototo_plans"("id") ON DELETE CASCADE,
  CONSTRAINT "isolation_points_machinery_id_machinery_catalogue_id_fk"
    FOREIGN KEY ("machinery_id") REFERENCES "machinery_catalogue"("id") ON DELETE RESTRICT,
  CONSTRAINT "isolation_points_equipment_energy_source_id_fk"
    FOREIGN KEY ("equipment_energy_source_id") REFERENCES "equipment_energy_sources"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "isolation_points_plan_id_idx"
  ON "isolation_points" ("plan_id");
CREATE INDEX IF NOT EXISTS "isolation_points_machinery_id_idx"
  ON "isolation_points" ("machinery_id");
CREATE UNIQUE INDEX IF NOT EXISTS "isolation_points_plan_number_unique"
  ON "isolation_points" ("plan_id", "isolation_number");

CREATE TABLE IF NOT EXISTS "lototo_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "plan_id" uuid NOT NULL,
  "workforce_user_id" uuid NOT NULL,
  "role" varchar(64) NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lototo_assignments_role_check"
    CHECK ("role" IN ('operator', 'safety-officer', 'hod')),
  CONSTRAINT "lototo_assignments_plan_id_lototo_plans_id_fk"
    FOREIGN KEY ("plan_id") REFERENCES "lototo_plans"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "lototo_assignments_plan_id_idx"
  ON "lototo_assignments" ("plan_id");
CREATE INDEX IF NOT EXISTS "lototo_assignments_workforce_user_id_idx"
  ON "lototo_assignments" ("workforce_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lototo_assignments_plan_user_role_unique"
  ON "lototo_assignments" ("plan_id", "workforce_user_id", "role");

CREATE TABLE IF NOT EXISTS "isolation_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "plan_id" uuid NOT NULL,
  "isolation_point_id" uuid NOT NULL,
  "sequence_order" integer NOT NULL,
  "requires_verification" boolean DEFAULT true NOT NULL,
  CONSTRAINT "isolation_sequences_plan_id_lototo_plans_id_fk"
    FOREIGN KEY ("plan_id") REFERENCES "lototo_plans"("id") ON DELETE CASCADE,
  CONSTRAINT "isolation_sequences_isolation_point_id_fk"
    FOREIGN KEY ("isolation_point_id") REFERENCES "isolation_points"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "isolation_sequences_plan_id_idx"
  ON "isolation_sequences" ("plan_id");
CREATE UNIQUE INDEX IF NOT EXISTS "isolation_sequences_plan_order_unique"
  ON "isolation_sequences" ("plan_id", "sequence_order");
CREATE UNIQUE INDEX IF NOT EXISTS "isolation_sequences_plan_point_unique"
  ON "isolation_sequences" ("plan_id", "isolation_point_id");

CREATE OR REPLACE FUNCTION enforce_lototo_plan_configuration_editable()
RETURNS trigger AS $$
DECLARE
  plan_status varchar(32);
  target_plan_id uuid;
BEGIN
  target_plan_id := COALESCE(NEW."plan_id", OLD."plan_id");

  SELECT "status" INTO plan_status
  FROM "lototo_plans"
  WHERE "id" = target_plan_id;

  IF plan_status IN ('in_execution', 'completed') THEN
    RAISE EXCEPTION 'lototo plan configuration is locked once execution has begun';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS equipment_energy_sources_plan_locked ON "equipment_energy_sources";
CREATE TRIGGER equipment_energy_sources_plan_locked
  BEFORE INSERT OR UPDATE OR DELETE ON "equipment_energy_sources"
  FOR EACH ROW EXECUTE FUNCTION enforce_lototo_plan_configuration_editable();

DROP TRIGGER IF EXISTS isolation_points_plan_locked ON "isolation_points";
CREATE TRIGGER isolation_points_plan_locked
  BEFORE INSERT OR UPDATE OR DELETE ON "isolation_points"
  FOR EACH ROW EXECUTE FUNCTION enforce_lototo_plan_configuration_editable();

DROP TRIGGER IF EXISTS lototo_assignments_plan_locked ON "lototo_assignments";
CREATE TRIGGER lototo_assignments_plan_locked
  BEFORE INSERT OR UPDATE OR DELETE ON "lototo_assignments"
  FOR EACH ROW EXECUTE FUNCTION enforce_lototo_plan_configuration_editable();

DROP TRIGGER IF EXISTS isolation_sequences_plan_locked ON "isolation_sequences";
CREATE TRIGGER isolation_sequences_plan_locked
  BEFORE INSERT OR UPDATE OR DELETE ON "isolation_sequences"
  FOR EACH ROW EXECUTE FUNCTION enforce_lototo_plan_configuration_editable();

CREATE OR REPLACE FUNCTION enforce_isolation_point_energy_source_plan_match()
RETURNS trigger AS $$
DECLARE
  energy_plan_id uuid;
BEGIN
  IF NEW."equipment_energy_source_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "plan_id" INTO energy_plan_id
  FROM "equipment_energy_sources"
  WHERE "id" = NEW."equipment_energy_source_id";

  IF energy_plan_id IS DISTINCT FROM NEW."plan_id" THEN
    RAISE EXCEPTION 'isolation_points equipment_energy_source_id must belong to the same plan';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS isolation_points_energy_source_plan_match ON "isolation_points";
CREATE TRIGGER isolation_points_energy_source_plan_match
  BEFORE INSERT OR UPDATE ON "isolation_points"
  FOR EACH ROW EXECUTE FUNCTION enforce_isolation_point_energy_source_plan_match();

CREATE OR REPLACE FUNCTION enforce_isolation_sequence_point_plan_match()
RETURNS trigger AS $$
DECLARE
  point_plan_id uuid;
BEGIN
  SELECT "plan_id" INTO point_plan_id
  FROM "isolation_points"
  WHERE "id" = NEW."isolation_point_id";

  IF point_plan_id IS DISTINCT FROM NEW."plan_id" THEN
    RAISE EXCEPTION 'isolation_sequences isolation_point_id must belong to the same plan';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS isolation_sequences_point_plan_match ON "isolation_sequences";
CREATE TRIGGER isolation_sequences_point_plan_match
  BEFORE INSERT OR UPDATE ON "isolation_sequences"
  FOR EACH ROW EXECUTE FUNCTION enforce_isolation_sequence_point_plan_match();

CREATE OR REPLACE FUNCTION enforce_lototo_plan_permit_exists()
RETURNS trigger AS $$
DECLARE
  permit_count integer;
BEGIN
  SELECT COUNT(*) INTO permit_count FROM "permits" WHERE "id" = NEW."permit_id";

  IF permit_count = 0 THEN
    RAISE EXCEPTION 'lototo_plans require an existing permit';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lototo_plans_require_permit ON "lototo_plans";
CREATE TRIGGER lototo_plans_require_permit
  BEFORE INSERT OR UPDATE ON "lototo_plans"
  FOR EACH ROW EXECUTE FUNCTION enforce_lototo_plan_permit_exists();
