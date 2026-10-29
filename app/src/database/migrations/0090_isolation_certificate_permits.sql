CREATE TABLE "isolation_certificate_permits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE cascade,
  "attachment_status" varchar(32) DEFAULT 'attached' NOT NULL,
  "attached_at" timestamp with time zone DEFAULT now() NOT NULL,
  "attached_by" uuid,
  "detached_at" timestamp with time zone,
  "detached_by" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX "isolation_certificate_permits_cert_permit_unique" ON "isolation_certificate_permits" ("certificate_id", "permit_id");
--> statement-breakpoint
CREATE INDEX "isolation_certificate_permits_tenant_id_idx" ON "isolation_certificate_permits" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "isolation_certificate_permits_cert_id_idx" ON "isolation_certificate_permits" ("certificate_id");
--> statement-breakpoint
CREATE INDEX "isolation_certificate_permits_permit_id_idx" ON "isolation_certificate_permits" ("permit_id");
--> statement-breakpoint
CREATE INDEX "isolation_certificate_permits_status_idx" ON "isolation_certificate_permits" ("certificate_id", "attachment_status");
