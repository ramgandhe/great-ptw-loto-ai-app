CREATE TABLE "isolation_sanction_tests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "test_reason" text NOT NULL,
  "status" varchar(32) DEFAULT 'in_test' NOT NULL,
  "authorized_by" uuid NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "points_temporarily_deisolated" jsonb NOT NULL,
  "pre_test_safety_checklist" jsonb NOT NULL,
  "post_test_zero_energy_verified" boolean DEFAULT false NOT NULL,
  "post_test_verifier_id" uuid,
  "post_test_verified_at" timestamp with time zone,
  "test_notes" text
);
--> statement-breakpoint
CREATE INDEX "isolation_sanction_tests_tenant_id_idx" ON "isolation_sanction_tests" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "isolation_sanction_tests_cert_id_idx" ON "isolation_sanction_tests" ("certificate_id");
--> statement-breakpoint
CREATE INDEX "isolation_sanction_tests_status_idx" ON "isolation_sanction_tests" ("certificate_id", "status");
