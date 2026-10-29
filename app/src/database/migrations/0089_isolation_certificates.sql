CREATE TABLE "isolation_certificates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "site_id" uuid REFERENCES "sites"("id") ON DELETE restrict,
  "certificate_number" varchar(32) NOT NULL,
  "title" varchar(255) NOT NULL,
  "discipline" varchar(32) DEFAULT 'combined' NOT NULL,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "procedure_id" uuid REFERENCES "lototo_procedures"("id") ON DELETE set null,
  "procedure_version_id" uuid REFERENCES "lototo_procedure_versions"("id") ON DELETE set null,
  "work_location_id" uuid REFERENCES "work_locations"("id") ON DELETE restrict,
  "asset_id" uuid REFERENCES "assets"("id") ON DELETE restrict,
  "isolation_authority_id" uuid,
  "approver_id" uuid,
  "lockbox_id" uuid,
  "approved_at" timestamp with time zone,
  "isolated_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "restoration_started_at" timestamp with time zone,
  "restored_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "is_long_term" boolean DEFAULT false NOT NULL,
  "lti_reason" text,
  "lti_audit_interval_days" integer DEFAULT 30 NOT NULL,
  "next_audit_due_date" timestamp with time zone,
  "last_audited_at" timestamp with time zone,
  "description" text,
  "safety_precautions" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "isolation_certificates_tenant_number_unique" ON "isolation_certificates" ("tenant_id", "certificate_number");
--> statement-breakpoint
CREATE INDEX "isolation_certificates_tenant_id_idx" ON "isolation_certificates" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "isolation_certificates_tenant_status_idx" ON "isolation_certificates" ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX "isolation_certificates_site_id_idx" ON "isolation_certificates" ("site_id");
--> statement-breakpoint
CREATE INDEX "isolation_certificates_asset_id_idx" ON "isolation_certificates" ("asset_id");
--> statement-breakpoint
CREATE INDEX "isolation_certificates_work_location_id_idx" ON "isolation_certificates" ("work_location_id");
--> statement-breakpoint
CREATE INDEX "isolation_certificates_procedure_id_idx" ON "isolation_certificates" ("procedure_id");
--> statement-breakpoint
CREATE INDEX "isolation_certificates_is_long_term_idx" ON "isolation_certificates" ("tenant_id", "is_long_term");
