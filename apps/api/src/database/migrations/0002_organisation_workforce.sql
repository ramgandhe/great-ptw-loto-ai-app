CREATE TABLE IF NOT EXISTS "organisations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "legal_name" varchar(255),
  "registration_number" varchar(128),
  "status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organisations_tenant_unique" ON "organisations" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organisations_tenant_id_idx" ON "organisations" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(64),
  "description" text,
  "status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plants_tenant_code_unique" ON "plants" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plants_tenant_id_idx" ON "plants" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "plant_id" uuid,
  "name" varchar(255) NOT NULL,
  "code" varchar(64),
  "description" text,
  "status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "departments_tenant_code_unique" ON "departments" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "departments_tenant_id_idx" ON "departments" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "departments_plant_id_idx" ON "departments" ("plant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "department_id" uuid,
  "name" varchar(255) NOT NULL,
  "code" varchar(64),
  "description" text,
  "status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "locations_tenant_code_unique" ON "locations" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "locations_tenant_id_idx" ON "locations" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "locations_department_id_idx" ON "locations" ("department_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approval_workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(64),
  "description" text,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "config" jsonb
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "approval_workflows_tenant_code_unique" ON "approval_workflows" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "approval_workflows_tenant_id_idx" ON "approval_workflows" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permit_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(64),
  "description" text,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "config" jsonb
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permit_templates_tenant_code_unique" ON "permit_templates" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_templates_tenant_id_idx" ON "permit_templates" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "channel" varchar(64),
  "event_type" varchar(64),
  "enabled" boolean DEFAULT true NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_preferences_tenant_id_idx" ON "notification_preferences" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(64),
  "status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agencies_tenant_code_unique" ON "agencies" ("tenant_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agencies_tenant_id_idx" ON "agencies" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(255),
  "phone" varchar(64),
  "department_id" uuid,
  "status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_tenant_id_idx" ON "employees" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employees_department_id_idx" ON "employees" ("department_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contractors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(255),
  "phone" varchar(64),
  "agency_id" uuid,
  "status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contractors_tenant_id_idx" ON "contractors" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contractors_agency_id_idx" ON "contractors" ("agency_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "workforce_user_id" uuid,
  "certification_name" varchar(255),
  "expiry_date" varchar(32),
  "description" text,
  "status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "competencies_tenant_id_idx" ON "competencies" ("tenant_id");
