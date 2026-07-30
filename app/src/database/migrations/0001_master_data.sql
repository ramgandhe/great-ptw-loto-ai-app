CREATE TABLE IF NOT EXISTS "permit_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "default_attributes" jsonb,
  "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permit_types_tenant_code_unique"
  ON "permit_types" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_types_tenant_id_idx"
  ON "permit_types" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ppe_catalogue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "category" varchar(128) NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ppe_catalogue_tenant_code_unique"
  ON "ppe_catalogue" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ppe_catalogue_tenant_id_idx"
  ON "ppe_catalogue" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ppe_catalogue_tenant_category_idx"
  ON "ppe_catalogue" ("tenant_id", "category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workstation_catalogue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workstation_catalogue_tenant_code_unique"
  ON "workstation_catalogue" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workstation_catalogue_tenant_id_idx"
  ON "workstation_catalogue" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "machinery_catalogue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "workstation_id" uuid NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "machinery_catalogue"
  ADD CONSTRAINT "machinery_catalogue_workstation_id_workstation_catalogue_id_fk"
  FOREIGN KEY ("workstation_id") REFERENCES "workstation_catalogue"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "machinery_catalogue_tenant_code_unique"
  ON "machinery_catalogue" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "machinery_catalogue_tenant_id_idx"
  ON "machinery_catalogue" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "machinery_catalogue_workstation_id_idx"
  ON "machinery_catalogue" ("workstation_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hazard_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "severity" varchar(32) DEFAULT 'medium' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hazard_categories_tenant_code_unique"
  ON "hazard_categories" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hazard_categories_tenant_id_idx"
  ON "hazard_categories" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "safety_checklists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "permit_type_id" uuid,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "safety_checklists"
  ADD CONSTRAINT "safety_checklists_permit_type_id_permit_types_id_fk"
  FOREIGN KEY ("permit_type_id") REFERENCES "permit_types"("id") ON DELETE set null;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "safety_checklists_tenant_code_unique"
  ON "safety_checklists" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_checklists_tenant_id_idx"
  ON "safety_checklists" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_checklists_permit_type_id_idx"
  ON "safety_checklists" ("permit_type_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "safety_checklist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "checklist_id" uuid NOT NULL,
  "sequence" integer NOT NULL,
  "description" text NOT NULL,
  "is_mandatory" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "safety_checklist_items"
  ADD CONSTRAINT "safety_checklist_items_checklist_id_safety_checklists_id_fk"
  FOREIGN KEY ("checklist_id") REFERENCES "safety_checklists"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "safety_checklist_items_checklist_sequence_unique"
  ON "safety_checklist_items" ("checklist_id", "sequence");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_checklist_items_checklist_id_idx"
  ON "safety_checklist_items" ("checklist_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL,
  "partial_import" boolean DEFAULT false NOT NULL,
  "total_rows" integer DEFAULT 0 NOT NULL,
  "success_count" integer DEFAULT 0 NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "error_summary" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_jobs_tenant_id_idx"
  ON "import_jobs" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_jobs_status_idx"
  ON "import_jobs" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_job_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "import_job_id" uuid NOT NULL,
  "row_number" integer NOT NULL,
  "entity_type" varchar(64) NOT NULL,
  "status" varchar(32) NOT NULL,
  "message" text,
  "entity_id" uuid
);
--> statement-breakpoint
ALTER TABLE "import_job_results"
  ADD CONSTRAINT "import_job_results_import_job_id_import_jobs_id_fk"
  FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_job_results_import_job_id_idx"
  ON "import_job_results" ("import_job_id");
