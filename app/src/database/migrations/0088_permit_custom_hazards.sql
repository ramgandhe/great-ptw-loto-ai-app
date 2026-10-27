ALTER TABLE "permit_hazards" ALTER COLUMN "hazard_category_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "permit_hazards" ADD COLUMN "custom_key" uuid;
--> statement-breakpoint
ALTER TABLE "permit_hazards" ADD COLUMN "custom_name" varchar(255);
--> statement-breakpoint
ALTER TABLE "permit_hazards" ADD COLUMN "custom_description" text;
--> statement-breakpoint
ALTER TABLE "permit_hazards" ADD COLUMN "catalogue_request" varchar(16) DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "permit_hazards" ADD CONSTRAINT "permit_hazards_catalogue_request_check" CHECK ("catalogue_request" IN ('none', 'pending', 'approved', 'rejected', 'withdrawn'));
--> statement-breakpoint
DROP INDEX IF EXISTS "permit_hazards_permit_hazard_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "permit_hazards_permit_hazard_unique" ON "permit_hazards" ("permit_id", "hazard_category_id") WHERE "hazard_category_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "permit_hazards_custom_key_unique" ON "permit_hazards" ("permit_id", "custom_key") WHERE "custom_key" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "hazard_catalogue_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "custom_key" uuid NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "consequences" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "controls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "permit_type_code" varchar(16),
  "site_id" uuid,
  "work_location_id" uuid,
  "asset_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  "requested_by" uuid NOT NULL,
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  "hazard_category_id" uuid,
  CONSTRAINT "hazard_catalogue_requests_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
ALTER TABLE "hazard_catalogue_requests" ADD CONSTRAINT "hazard_catalogue_requests_permit_id_permits_id_fk" FOREIGN KEY ("permit_id") REFERENCES "public"."permits"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "hazard_catalogue_requests_tenant_status_idx" ON "hazard_catalogue_requests" ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX "hazard_catalogue_requests_permit_idx" ON "hazard_catalogue_requests" ("permit_id");
