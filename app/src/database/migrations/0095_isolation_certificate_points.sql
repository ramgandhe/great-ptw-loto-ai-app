CREATE TABLE "isolation_certificate_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "source_point_id" uuid REFERENCES "lototo_procedure_lockout_points"("id") ON DELETE set null,
  "sort_order" integer NOT NULL,
  "remove_order" integer,
  "point_code" varchar(64) NOT NULL,
  "energy_type" varchar(64) NOT NULL,
  "energy_other_text" varchar(255),
  "magnitude" varchar(128),
  "location_text" text,
  "method" varchar(64),
  "normal_position" varchar(128),
  "isolated_position" varchar(128),
  "action" text,
  "restore_action" text,
  "device" varchar(128),
  "proof" varchar(64) NOT NULL,
  "drawing_reference" varchar(255),
  "position_confirmed" varchar(128),
  "lock_number" varchar(64),
  "tag_number" varchar(64),
  "applied_by" uuid,
  "applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "isolation_certificate_points_cert_id_idx" ON "isolation_certificate_points" ("certificate_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "isolation_certificate_points_cert_code_unique" ON "isolation_certificate_points" ("certificate_id", "point_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "isolation_certificate_points_cert_order_unique" ON "isolation_certificate_points" ("certificate_id", "sort_order");
--> statement-breakpoint
CREATE TABLE "isolation_point_proofs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "point_id" uuid NOT NULL REFERENCES "isolation_certificate_points"("id") ON DELETE cascade,
  "proof" varchar(64) NOT NULL,
  "result" varchar(16) NOT NULL,
  "instrument_make_model" varchar(128),
  "instrument_serial_no" varchar(128),
  "calibration_expiry_date" varchar(10),
  "readings" jsonb NOT NULL,
  "comment" text,
  "verified_by" uuid NOT NULL,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "isolation_point_proofs_cert_id_idx" ON "isolation_point_proofs" ("certificate_id");
--> statement-breakpoint
CREATE INDEX "isolation_point_proofs_point_id_idx" ON "isolation_point_proofs" ("point_id");
