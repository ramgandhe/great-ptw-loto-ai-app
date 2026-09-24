ALTER TABLE "permits" ADD COLUMN IF NOT EXISTS "gas_testing_required" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "gas_testing_catalogue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "workstation_id" uuid NOT NULL REFERENCES "workstation_catalogue"("id") ON DELETE RESTRICT,
  "parameter" varchar(255) NOT NULL,
  "unit" varchar(32) NOT NULL,
  "minimum" double precision NOT NULL,
  "maximum" double precision NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "gas_testing_catalogue_tenant_ws_parameter_unique"
  ON "gas_testing_catalogue" ("tenant_id", "workstation_id", "parameter");
CREATE INDEX IF NOT EXISTS "gas_testing_catalogue_tenant_id_idx" ON "gas_testing_catalogue" ("tenant_id");
CREATE INDEX IF NOT EXISTS "gas_testing_catalogue_workstation_id_idx" ON "gas_testing_catalogue" ("workstation_id");

CREATE TABLE IF NOT EXISTS "permit_gas_testing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "gas_testing_catalogue_id" uuid NOT NULL REFERENCES "gas_testing_catalogue"("id") ON DELETE RESTRICT,
  "workstation_id" uuid NOT NULL,
  "parameter" varchar(255) NOT NULL,
  "unit" varchar(32) NOT NULL,
  "minimum" double precision NOT NULL,
  "maximum" double precision NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_gas_testing_permit_item_unique"
  ON "permit_gas_testing" ("permit_id", "gas_testing_catalogue_id");
CREATE INDEX IF NOT EXISTS "permit_gas_testing_permit_id_idx" ON "permit_gas_testing" ("permit_id");
