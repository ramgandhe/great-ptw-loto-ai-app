CREATE TABLE "zero_energy_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "point_code" varchar(64) NOT NULL,
  "verification_category" varchar(64) NOT NULL,
  "result" varchar(32) DEFAULT 'pass' NOT NULL,
  "instrument_make_model" varchar(128),
  "instrument_serial_no" varchar(128),
  "calibration_expiry_date" timestamp with time zone,
  "readings_payload" jsonb NOT NULL,
  "photo_storage_key" varchar(512),
  "photo_checksum" varchar(128),
  "verified_by" uuid NOT NULL,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL,
  "comment" text
);
--> statement-breakpoint
CREATE INDEX "zero_energy_verifications_tenant_id_idx" ON "zero_energy_verifications" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "zero_energy_verifications_cert_id_idx" ON "zero_energy_verifications" ("certificate_id");
--> statement-breakpoint
CREATE INDEX "zero_energy_verifications_point_code_idx" ON "zero_energy_verifications" ("certificate_id", "point_code");
--> statement-breakpoint
CREATE INDEX "zero_energy_verifications_verified_by_idx" ON "zero_energy_verifications" ("verified_by");
