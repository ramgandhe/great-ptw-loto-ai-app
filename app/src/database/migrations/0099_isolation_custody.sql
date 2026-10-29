ALTER TABLE "isolation_blinds" ADD COLUMN "point_id" uuid REFERENCES "isolation_certificate_points"("id") ON DELETE set null;
--> statement-breakpoint
CREATE TABLE "isolation_shift_handovers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "outgoing_authority_id" uuid,
  "incoming_authority_id" uuid NOT NULL,
  "joint_inspection_completed" boolean DEFAULT false NOT NULL,
  "integrity_notes" text,
  "active_permits_reviewed" boolean DEFAULT false NOT NULL,
  "handed_over_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "isolation_shift_handovers_tenant_id_idx" ON "isolation_shift_handovers" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "isolation_shift_handovers_certificate_id_idx" ON "isolation_shift_handovers" ("certificate_id", "handed_over_at");
--> statement-breakpoint
CREATE TABLE "isolation_lti_walks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "certificate_id" uuid NOT NULL REFERENCES "isolation_certificates"("id") ON DELETE cascade,
  "walked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "walked_by" uuid NOT NULL,
  "notes" text
);
--> statement-breakpoint
CREATE INDEX "isolation_lti_walks_tenant_id_idx" ON "isolation_lti_walks" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "isolation_lti_walks_certificate_id_idx" ON "isolation_lti_walks" ("certificate_id", "walked_at");
