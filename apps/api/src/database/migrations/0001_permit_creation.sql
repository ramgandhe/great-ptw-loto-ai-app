CREATE TABLE IF NOT EXISTS "permits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "reference" varchar(32),
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "permit_type_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "work_scope" text,
  "plant_id" uuid,
  "department_id" uuid,
  "location_id" uuid,
  "workstation_id" uuid,
  "machinery_id" uuid,
  "planned_start_at" timestamp with time zone,
  "planned_end_at" timestamp with time zone,
  "submitted_at" timestamp with time zone,
  "submitted_by" uuid,
  CONSTRAINT "permits_status_check" CHECK ("status" IN ('draft', 'pending_approval'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "permits_tenant_reference_unique"
  ON "permits" ("tenant_id", "reference");
CREATE INDEX IF NOT EXISTS "permits_tenant_id_idx" ON "permits" ("tenant_id");
CREATE INDEX IF NOT EXISTS "permits_status_idx" ON "permits" ("status");
CREATE INDEX IF NOT EXISTS "permits_tenant_status_idx" ON "permits" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "permits_permit_type_id_idx" ON "permits" ("permit_type_id");

CREATE TABLE IF NOT EXISTS "permit_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL,
  "current_step" integer DEFAULT 0 NOT NULL,
  "form_snapshot" jsonb,
  "last_autosaved_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "permit_drafts_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_drafts_permit_id_unique"
  ON "permit_drafts" ("permit_id");

CREATE TABLE IF NOT EXISTS "permit_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "content_type" varchar(128) NOT NULL,
  "file_size" bigint NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL,
  "checksum" varchar(128),
  "uploaded_by" uuid NOT NULL,
  CONSTRAINT "permit_attachments_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "permit_attachments_permit_id_idx"
  ON "permit_attachments" ("permit_id");

CREATE TABLE IF NOT EXISTS "permit_hazards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL,
  "hazard_category_id" uuid NOT NULL,
  "description" text,
  CONSTRAINT "permit_hazards_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_hazards_permit_hazard_unique"
  ON "permit_hazards" ("permit_id", "hazard_category_id");
CREATE INDEX IF NOT EXISTS "permit_hazards_permit_id_idx"
  ON "permit_hazards" ("permit_id");

CREATE TABLE IF NOT EXISTS "permit_ppe" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL,
  "ppe_catalogue_id" uuid NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "permit_ppe_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_ppe_permit_ppe_unique"
  ON "permit_ppe" ("permit_id", "ppe_catalogue_id");
CREATE INDEX IF NOT EXISTS "permit_ppe_permit_id_idx"
  ON "permit_ppe" ("permit_id");

CREATE TABLE IF NOT EXISTS "permit_executors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL,
  "workforce_user_id" uuid NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  CONSTRAINT "permit_executors_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_executors_permit_user_unique"
  ON "permit_executors" ("permit_id", "workforce_user_id");
CREATE INDEX IF NOT EXISTS "permit_executors_permit_id_idx"
  ON "permit_executors" ("permit_id");
