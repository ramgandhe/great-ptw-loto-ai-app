CREATE TABLE "lototo_tenant_options" (
  "tenant_id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "require_evidence_photo" boolean DEFAULT false NOT NULL,
  "require_distinct_prover" boolean DEFAULT false NOT NULL,
  "require_second_approval_before_isolate" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "isolation_point_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "point_id" uuid NOT NULL REFERENCES "isolation_certificate_points"("id") ON DELETE cascade,
  "kind" varchar(16) NOT NULL,
  "proof_id" uuid REFERENCES "isolation_point_proofs"("id") ON DELETE set null,
  "file_name" varchar(255) NOT NULL,
  "content_type" varchar(128) NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "isolation_point_evidence_cert_id_idx" ON "isolation_point_evidence" ("certificate_id");
--> statement-breakpoint
CREATE INDEX "isolation_point_evidence_point_id_idx" ON "isolation_point_evidence" ("point_id");
--> statement-breakpoint
CREATE TABLE "isolation_absent_lock_removals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "lockbox_id" uuid REFERENCES "isolation_lockboxes"("id") ON DELETE set null,
  "crew_lock_id" uuid REFERENCES "lockbox_crew_locks"("id") ON DELETE set null,
  "owner_user_id" uuid NOT NULL,
  "owner_name" varchar(255) NOT NULL,
  "personal_lock_number" varchar(64) NOT NULL,
  "contact_attempts" text NOT NULL,
  "clear_of_plant_confirmed" boolean DEFAULT false NOT NULL,
  "authoriser_one_id" uuid NOT NULL,
  "authoriser_two_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "removed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "removed_by" uuid NOT NULL,
  "owner_notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "isolation_absent_lock_removals_cert_id_idx" ON "isolation_absent_lock_removals" ("certificate_id");
--> statement-breakpoint
CREATE INDEX "isolation_absent_lock_removals_owner_idx" ON "isolation_absent_lock_removals" ("tenant_id", "owner_user_id");
