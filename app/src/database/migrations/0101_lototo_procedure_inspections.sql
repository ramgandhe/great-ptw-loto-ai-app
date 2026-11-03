CREATE TABLE "lototo_procedure_inspections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "procedure_id" uuid NOT NULL REFERENCES "lototo_procedures"("id") ON DELETE cascade,
  "procedure_version_id" uuid REFERENCES "lototo_procedure_versions"("id") ON DELETE set null,
  "inspected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "inspector_id" uuid NOT NULL,
  "result" varchar(32) NOT NULL,
  "employees_observed" text,
  "notes" text,
  "next_due_on" varchar(10)
);
--> statement-breakpoint
CREATE INDEX "lototo_procedure_inspections_procedure_id_idx" ON "lototo_procedure_inspections" ("procedure_id");
--> statement-breakpoint
CREATE INDEX "lototo_procedure_inspections_tenant_id_idx" ON "lototo_procedure_inspections" ("tenant_id");
