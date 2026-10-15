CREATE TABLE "default_energy_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "name" varchar(64) NOT NULL,
  "code" varchar(64) NOT NULL,
  "is_fallback" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "default_energy_sources_name_unique" ON "default_energy_sources" (lower("name"));
--> statement-breakpoint
CREATE UNIQUE INDEX "default_energy_sources_code_unique" ON "default_energy_sources" (lower("code"));
--> statement-breakpoint
CREATE UNIQUE INDEX "default_energy_sources_fallback_unique" ON "default_energy_sources" ("is_fallback") WHERE "is_fallback" = true;
--> statement-breakpoint
CREATE TABLE "energy_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "energy_sources_tenant_code_unique" ON "energy_sources" ("tenant_id", lower("code"));
--> statement-breakpoint
CREATE UNIQUE INDEX "energy_sources_tenant_name_unique" ON "energy_sources" ("tenant_id", lower("name"));
--> statement-breakpoint
CREATE INDEX "energy_sources_tenant_id_idx" ON "energy_sources" ("tenant_id");
--> statement-breakpoint
INSERT INTO "default_energy_sources" ("name", "code", "is_fallback") VALUES
  ('Electrical', 'electrical', false),
  ('Mechanical', 'mechanical', false),
  ('Hydraulic', 'hydraulic', false),
  ('Pneumatic', 'pneumatic', false),
  ('Chemical', 'chemical', false),
  ('Thermal', 'thermal', false),
  ('Pressure', 'pressure', false),
  ('Gravity', 'gravity', false),
  ('Stored Energy', 'stored_energy', false),
  ('Radiation', 'radiation', false),
  ('Other', 'other', true);
