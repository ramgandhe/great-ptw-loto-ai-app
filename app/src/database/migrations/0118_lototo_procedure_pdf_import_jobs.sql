CREATE TABLE "lototo_procedure_pdf_import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'queued' NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL,
  "confirm_override" boolean DEFAULT false NOT NULL,
  "procedure_id" uuid,
  "extraction_result" jsonb,
  "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "actor" jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lototo_pdf_import_jobs_tenant_id_idx" ON "lototo_procedure_pdf_import_jobs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "lototo_pdf_import_jobs_status_idx" ON "lototo_procedure_pdf_import_jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "lototo_pdf_import_jobs_expires_at_idx" ON "lototo_procedure_pdf_import_jobs" USING btree ("expires_at");
