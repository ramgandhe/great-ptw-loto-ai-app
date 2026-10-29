CREATE TABLE "isolation_lockboxes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "box_number" varchar(64) NOT NULL,
  "location_description" text,
  "master_lock_serial" varchar(64) NOT NULL,
  "custody_status" varchar(32) DEFAULT 'open_for_keys' NOT NULL,
  "sealed_at" timestamp with time zone,
  "sealed_by" uuid,
  "released_at" timestamp with time zone,
  "released_by" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX "isolation_lockboxes_cert_box_unique" ON "isolation_lockboxes" ("certificate_id", "box_number");
--> statement-breakpoint
CREATE INDEX "isolation_lockboxes_tenant_id_idx" ON "isolation_lockboxes" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "isolation_lockboxes_cert_id_idx" ON "isolation_lockboxes" ("certificate_id");
--> statement-breakpoint
CREATE INDEX "isolation_lockboxes_status_idx" ON "isolation_lockboxes" ("custody_status");
--> statement-breakpoint
CREATE TABLE "lockbox_crew_locks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "lockbox_id" uuid NOT NULL REFERENCES "isolation_lockboxes"("id") ON DELETE cascade,
  "permit_id" uuid REFERENCES "permits"("id") ON DELETE set null,
  "workforce_user_id" uuid NOT NULL,
  "worker_name" varchar(255) NOT NULL,
  "company" varchar(255),
  "personal_lock_number" varchar(64) NOT NULL,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  "applied_by" uuid,
  "removed_at" timestamp with time zone,
  "removed_by" uuid
);
--> statement-breakpoint
CREATE INDEX "lockbox_crew_locks_tenant_id_idx" ON "lockbox_crew_locks" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "lockbox_crew_locks_lockbox_id_idx" ON "lockbox_crew_locks" ("lockbox_id");
--> statement-breakpoint
CREATE INDEX "lockbox_crew_locks_user_id_idx" ON "lockbox_crew_locks" ("workforce_user_id");
--> statement-breakpoint
CREATE INDEX "lockbox_crew_locks_permit_id_idx" ON "lockbox_crew_locks" ("permit_id");
--> statement-breakpoint
CREATE INDEX "lockbox_crew_locks_active_idx" ON "lockbox_crew_locks" ("lockbox_id", "removed_at");
