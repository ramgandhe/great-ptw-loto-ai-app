CREATE TABLE "isolation_blinds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "blind_tag_number" varchar(64) NOT NULL,
  "line_tag_number" varchar(128) NOT NULL,
  "pid_reference" varchar(128),
  "blind_type" varchar(32) DEFAULT 'slip_blind' NOT NULL,
  "flange_rating" varchar(64),
  "blind_size" varchar(64),
  "material_thickness" varchar(64),
  "status" varchar(32) DEFAULT 'planned' NOT NULL,
  "installed_at" timestamp with time zone,
  "installed_by" uuid,
  "installed_torque_nm" double precision,
  "removed_at" timestamp with time zone,
  "removed_by" uuid,
  "gasket_replaced" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "isolation_blinds_tenant_tag_unique" ON "isolation_blinds" ("tenant_id", "blind_tag_number");
--> statement-breakpoint
CREATE INDEX "isolation_blinds_tenant_id_idx" ON "isolation_blinds" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "isolation_blinds_cert_id_idx" ON "isolation_blinds" ("certificate_id");
--> statement-breakpoint
CREATE INDEX "isolation_blinds_status_idx" ON "isolation_blinds" ("certificate_id", "status");
