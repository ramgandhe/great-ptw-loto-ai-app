CREATE TABLE IF NOT EXISTS "lototo_procedures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "machinery_id" uuid NOT NULL REFERENCES "machinery_catalogue"("id") ON DELETE RESTRICT,
  "workstation_id" uuid REFERENCES "workstation_catalogue"("id") ON DELETE RESTRICT,
  "code" varchar(64) NOT NULL,
  "title" varchar(255) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'draft',
  "published_version_id" uuid,
  "legacy_plan_id" uuid REFERENCES "lototo_plans"("id") ON DELETE SET NULL,
  CONSTRAINT "lototo_procedures_status_check" CHECK ("status" IN ('draft', 'published'))
);

CREATE INDEX IF NOT EXISTS "lototo_procedures_tenant_id_idx" ON "lototo_procedures" ("tenant_id");
CREATE INDEX IF NOT EXISTS "lototo_procedures_machinery_id_idx" ON "lototo_procedures" ("machinery_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lototo_procedures_tenant_code_unique" ON "lototo_procedures" ("tenant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "lototo_procedures_legacy_plan_id_unique" ON "lototo_procedures" ("legacy_plan_id");

CREATE TABLE IF NOT EXISTS "lototo_procedure_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "procedure_id" uuid NOT NULL REFERENCES "lototo_procedures"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "facility" varchar(255),
  "location_text" varchar(255),
  "purpose" text,
  "scope" text,
  "authorization" text,
  "enforcement" text,
  "description" text,
  "published_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "lototo_procedure_versions_procedure_id_idx"
  ON "lototo_procedure_versions" ("procedure_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lototo_procedure_versions_procedure_number_unique"
  ON "lototo_procedure_versions" ("procedure_id", "version_number");

ALTER TABLE "lototo_procedures"
  ADD CONSTRAINT "lototo_procedures_published_version_id_fk"
  FOREIGN KEY ("published_version_id") REFERENCES "lototo_procedure_versions"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "lototo_procedure_lockout_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "version_id" uuid NOT NULL REFERENCES "lototo_procedure_versions"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL,
  "point_code" varchar(64) NOT NULL,
  "energy_type" varchar(64) NOT NULL,
  "magnitude" varchar(128),
  "location_text" text,
  "action" text,
  "device" varchar(128),
  "verification_method" text
);

CREATE INDEX IF NOT EXISTS "lototo_procedure_lockout_points_version_id_idx"
  ON "lototo_procedure_lockout_points" ("version_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lototo_procedure_lockout_points_version_code_unique"
  ON "lototo_procedure_lockout_points" ("version_id", "point_code");
CREATE UNIQUE INDEX IF NOT EXISTS "lototo_procedure_lockout_points_version_order_unique"
  ON "lototo_procedure_lockout_points" ("version_id", "sort_order");

CREATE TABLE IF NOT EXISTS "lototo_procedure_sequence_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "version_id" uuid NOT NULL REFERENCES "lototo_procedure_versions"("id") ON DELETE CASCADE,
  "phase" varchar(16) NOT NULL,
  "sequence_order" integer NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  CONSTRAINT "lototo_procedure_sequence_steps_phase_check" CHECK ("phase" IN ('apply', 'remove'))
);

CREATE INDEX IF NOT EXISTS "lototo_procedure_sequence_steps_version_id_idx"
  ON "lototo_procedure_sequence_steps" ("version_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lototo_procedure_sequence_steps_phase_order_unique"
  ON "lototo_procedure_sequence_steps" ("version_id", "phase", "sequence_order");

CREATE TABLE IF NOT EXISTS "lototo_procedure_authorized_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "version_id" uuid NOT NULL REFERENCES "lototo_procedure_versions"("id") ON DELETE CASCADE,
  "role" varchar(64) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "lototo_procedure_authorized_roles_version_role_unique"
  ON "lototo_procedure_authorized_roles" ("version_id", "role");

CREATE TABLE IF NOT EXISTS "lototo_procedure_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "version_id" uuid NOT NULL REFERENCES "lototo_procedure_versions"("id") ON DELETE CASCADE,
  "lockout_point_id" uuid REFERENCES "lototo_procedure_lockout_points"("id") ON DELETE SET NULL,
  "file_name" varchar(255) NOT NULL,
  "content_type" varchar(128) NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL
);

CREATE INDEX IF NOT EXISTS "lototo_procedure_photos_version_id_idx"
  ON "lototo_procedure_photos" ("version_id");

CREATE TABLE IF NOT EXISTS "permit_lototo_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "procedure_id" uuid NOT NULL REFERENCES "lototo_procedures"("id") ON DELETE RESTRICT,
  "procedure_version_id" uuid NOT NULL REFERENCES "lototo_procedure_versions"("id") ON DELETE RESTRICT,
  "frozen_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_lototo_instances_permit_procedure_unique"
  ON "permit_lototo_instances" ("permit_id", "procedure_id");
CREATE INDEX IF NOT EXISTS "permit_lototo_instances_permit_id_idx"
  ON "permit_lototo_instances" ("permit_id");
CREATE INDEX IF NOT EXISTS "permit_lototo_instances_procedure_id_idx"
  ON "permit_lototo_instances" ("procedure_id");

CREATE TABLE IF NOT EXISTS "permit_lototo_extra_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "instance_id" uuid NOT NULL REFERENCES "permit_lototo_instances"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL,
  "point_code" varchar(64) NOT NULL,
  "energy_type" varchar(64) NOT NULL,
  "magnitude" varchar(128),
  "location_text" text,
  "action" text,
  "device" varchar(128),
  "verification_method" text
);

CREATE INDEX IF NOT EXISTS "permit_lototo_extra_points_instance_id_idx"
  ON "permit_lototo_extra_points" ("instance_id");
CREATE UNIQUE INDEX IF NOT EXISTS "permit_lototo_extra_points_instance_code_unique"
  ON "permit_lototo_extra_points" ("instance_id", "point_code");

CREATE TABLE IF NOT EXISTS "permit_lototo_step_na" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "instance_id" uuid NOT NULL REFERENCES "permit_lototo_instances"("id") ON DELETE CASCADE,
  "base_point_id" uuid REFERENCES "lototo_procedure_lockout_points"("id") ON DELETE RESTRICT,
  "extra_point_id" uuid REFERENCES "permit_lototo_extra_points"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  CONSTRAINT "permit_lototo_step_na_target_check" CHECK (
    ("base_point_id" IS NOT NULL AND "extra_point_id" IS NULL)
    OR ("base_point_id" IS NULL AND "extra_point_id" IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS "permit_lototo_step_na_instance_id_idx"
  ON "permit_lototo_step_na" ("instance_id");
CREATE UNIQUE INDEX IF NOT EXISTS "permit_lototo_step_na_base_point_unique"
  ON "permit_lototo_step_na" ("instance_id", "base_point_id");
CREATE UNIQUE INDEX IF NOT EXISTS "permit_lototo_step_na_extra_point_unique"
  ON "permit_lototo_step_na" ("instance_id", "extra_point_id");

CREATE TABLE IF NOT EXISTS "permit_lototo_crew" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "instance_id" uuid NOT NULL REFERENCES "permit_lototo_instances"("id") ON DELETE CASCADE,
  "workforce_user_id" uuid NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_lototo_crew_instance_user_unique"
  ON "permit_lototo_crew" ("instance_id", "workforce_user_id");
CREATE INDEX IF NOT EXISTS "permit_lototo_crew_instance_id_idx"
  ON "permit_lototo_crew" ("instance_id");

CREATE TABLE IF NOT EXISTS "permit_lototo_verifiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "instance_id" uuid NOT NULL REFERENCES "permit_lototo_instances"("id") ON DELETE CASCADE,
  "workforce_user_id" uuid NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_lototo_verifiers_instance_user_unique"
  ON "permit_lototo_verifiers" ("instance_id", "workforce_user_id");
CREATE INDEX IF NOT EXISTS "permit_lototo_verifiers_instance_id_idx"
  ON "permit_lototo_verifiers" ("instance_id");

INSERT INTO "lototo_procedures" (
  "id", "created_at", "updated_at", "created_by", "updated_by",
  "tenant_id", "machinery_id", "workstation_id", "code", "title", "status", "legacy_plan_id"
)
SELECT
  gen_random_uuid(),
  p."created_at",
  p."updated_at",
  p."created_by",
  p."updated_by",
  p."tenant_id",
  p."machinery_id",
  p."workstation_id",
  COALESCE(
    NULLIF(p."reference", ''),
    'LTO-' || REPLACE(p."id"::text, '-', '')
  ),
  p."title",
  CASE
    WHEN p."status" IN ('ready', 'in_execution', 'completed') THEN 'published'
    ELSE 'draft'
  END,
  p."id"
FROM "lototo_plans" p
WHERE p."machinery_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "lototo_procedures" lp WHERE lp."legacy_plan_id" = p."id"
  );

INSERT INTO "lototo_procedure_versions" (
  "id", "created_at", "updated_at", "created_by", "updated_by",
  "procedure_id", "version_number", "description", "published_at"
)
SELECT
  gen_random_uuid(),
  lp."created_at",
  lp."updated_at",
  lp."created_by",
  lp."updated_by",
  lp."id",
  1,
  p."description",
  CASE WHEN lp."status" = 'published' THEN lp."updated_at" ELSE NULL END
FROM "lototo_procedures" lp
INNER JOIN "lototo_plans" p ON p."id" = lp."legacy_plan_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "lototo_procedure_versions" v WHERE v."procedure_id" = lp."id"
);

UPDATE "lototo_procedures" lp
SET "published_version_id" = v."id"
FROM "lototo_procedure_versions" v
WHERE v."procedure_id" = lp."id"
  AND v."version_number" = 1
  AND lp."status" = 'published'
  AND lp."published_version_id" IS NULL;

INSERT INTO "lototo_procedure_lockout_points" (
  "id", "created_at", "updated_at", "created_by", "updated_by",
  "version_id", "sort_order", "point_code", "energy_type", "location_text", "device", "verification_method"
)
SELECT
  gen_random_uuid(),
  src."created_at",
  src."updated_at",
  src."created_by",
  src."updated_by",
  src."version_id",
  ROW_NUMBER() OVER (
    PARTITION BY src."version_id"
    ORDER BY COALESCE(src."sequence_order", 9999), src."isolation_number"
  ),
  src."isolation_number",
  src."energy_type",
  src."location_text",
  src."device",
  src."verification_method"
FROM (
  SELECT
    ip."created_at",
    ip."updated_at",
    ip."created_by",
    ip."updated_by",
    v."id" AS version_id,
    seq."sequence_order",
    ip."isolation_number",
    COALESCE(es."energy_source_type", 'unspecified') AS energy_type,
    ip."description" AS location_text,
    es."lock_method" AS device,
    CASE WHEN ip."verification_required" THEN 'Verify isolation' ELSE NULL END AS verification_method
  FROM "isolation_points" ip
  INNER JOIN "lototo_procedures" lp ON lp."legacy_plan_id" = ip."plan_id"
  INNER JOIN "lototo_procedure_versions" v ON v."procedure_id" = lp."id" AND v."version_number" = 1
  LEFT JOIN "equipment_energy_sources" es ON es."id" = ip."equipment_energy_source_id"
  LEFT JOIN "isolation_sequences" seq ON seq."isolation_point_id" = ip."id"
  WHERE NOT EXISTS (
    SELECT 1
    FROM "lototo_procedure_lockout_points" pt
    WHERE pt."version_id" = v."id" AND pt."point_code" = ip."isolation_number"
  )
) src;

INSERT INTO "lototo_procedure_sequence_steps" (
  "id", "created_at", "updated_at", "created_by", "updated_by",
  "version_id", "phase", "sequence_order", "title", "description"
)
SELECT
  gen_random_uuid(),
  seq."created_at",
  seq."updated_at",
  seq."created_by",
  seq."updated_by",
  v."id",
  'apply',
  seq."sequence_order",
  ip."isolation_number",
  ip."description"
FROM "isolation_sequences" seq
INNER JOIN "isolation_points" ip ON ip."id" = seq."isolation_point_id"
INNER JOIN "lototo_procedures" lp ON lp."legacy_plan_id" = seq."plan_id"
INNER JOIN "lototo_procedure_versions" v ON v."procedure_id" = lp."id" AND v."version_number" = 1
WHERE NOT EXISTS (
  SELECT 1
  FROM "lototo_procedure_sequence_steps" st
  WHERE st."version_id" = v."id" AND st."phase" = 'apply' AND st."sequence_order" = seq."sequence_order"
);

INSERT INTO "permit_lototo_instances" (
  "id", "created_at", "updated_at", "created_by", "updated_by",
  "permit_id", "procedure_id", "procedure_version_id"
)
SELECT
  gen_random_uuid(),
  src."created_at",
  src."updated_at",
  src."created_by",
  src."updated_by",
  src."permit_id",
  src."procedure_id",
  src."version_id"
FROM (
  SELECT
    pl."created_at",
    pl."updated_at",
    pl."created_by",
    pl."updated_by",
    pl."permit_id",
    lp."id" AS procedure_id,
    v."id" AS version_id
  FROM "permit_lototo" pl
  INNER JOIN "lototo_procedures" lp ON lp."legacy_plan_id" = pl."lototo_plan_id"
  INNER JOIN "lototo_procedure_versions" v ON v."procedure_id" = lp."id" AND v."version_number" = 1
  UNION
  SELECT
    p."created_at",
    p."updated_at",
    p."created_by",
    p."updated_by",
    p."permit_id",
    lp."id",
    v."id"
  FROM "lototo_plans" p
  INNER JOIN "lototo_procedures" lp ON lp."legacy_plan_id" = p."id"
  INNER JOIN "lototo_procedure_versions" v ON v."procedure_id" = lp."id" AND v."version_number" = 1
  WHERE p."permit_id" IS NOT NULL
) src
WHERE NOT EXISTS (
  SELECT 1
  FROM "permit_lototo_instances" i
  WHERE i."permit_id" = src."permit_id" AND i."procedure_id" = src."procedure_id"
);

INSERT INTO "permit_lototo_crew" (
  "instance_id", "workforce_user_id", "created_by", "updated_by"
)
SELECT DISTINCT i."id", a."workforce_user_id", a."created_by", a."updated_by"
FROM "lototo_assignments" a
INNER JOIN "lototo_procedures" lp ON lp."legacy_plan_id" = a."plan_id"
INNER JOIN "permit_lototo_instances" i ON i."procedure_id" = lp."id"
WHERE a."role" = 'operator'
  AND NOT EXISTS (
    SELECT 1 FROM "permit_lototo_crew" c
    WHERE c."instance_id" = i."id" AND c."workforce_user_id" = a."workforce_user_id"
  );

INSERT INTO "permit_lototo_verifiers" (
  "instance_id", "workforce_user_id", "created_by", "updated_by"
)
SELECT DISTINCT i."id", a."workforce_user_id", a."created_by", a."updated_by"
FROM "lototo_assignments" a
INNER JOIN "lototo_procedures" lp ON lp."legacy_plan_id" = a."plan_id"
INNER JOIN "permit_lototo_instances" i ON i."procedure_id" = lp."id"
WHERE a."role" = 'safety-officer'
  AND NOT EXISTS (
    SELECT 1 FROM "permit_lototo_verifiers" vr
    WHERE vr."instance_id" = i."id" AND vr."workforce_user_id" = a."workforce_user_id"
  );
