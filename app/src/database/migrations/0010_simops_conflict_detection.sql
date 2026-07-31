CREATE TABLE IF NOT EXISTS "simops_conflicts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'detected' NOT NULL,
  "severity" varchar(16) NOT NULL,
  "primary_conflict_type" varchar(32) NOT NULL,
  "conflict_types" jsonb NOT NULL,
  "fingerprint" varchar(128) NOT NULL,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "overlap_start_at" timestamp with time zone,
  "overlap_end_at" timestamp with time zone,
  "location_id" uuid,
  "workstation_id" uuid,
  "machinery_id" uuid,
  "details" jsonb,
  CONSTRAINT "simops_conflicts_status_check"
    CHECK ("status" IN ('detected', 'pending_assessment', 'resolved', 'rejected')),
  CONSTRAINT "simops_conflicts_severity_check"
    CHECK ("severity" IN ('low', 'medium', 'high')),
  CONSTRAINT "simops_conflicts_primary_conflict_type_check"
    CHECK ("primary_conflict_type" IN (
      'location',
      'schedule',
      'equipment',
      'permit_type',
      'energy_source',
      'adjacency'
    )),
  CONSTRAINT "simops_conflicts_location_id_locations_id_fk"
    FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL,
  CONSTRAINT "simops_conflicts_workstation_id_workstation_catalogue_id_fk"
    FOREIGN KEY ("workstation_id") REFERENCES "workstation_catalogue"("id") ON DELETE SET NULL,
  CONSTRAINT "simops_conflicts_machinery_id_machinery_catalogue_id_fk"
    FOREIGN KEY ("machinery_id") REFERENCES "machinery_catalogue"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "simops_conflicts_tenant_id_idx"
  ON "simops_conflicts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "simops_conflicts_tenant_status_idx"
  ON "simops_conflicts" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "simops_conflicts_tenant_severity_idx"
  ON "simops_conflicts" ("tenant_id", "severity");
CREATE INDEX IF NOT EXISTS "simops_conflicts_detected_at_idx"
  ON "simops_conflicts" ("detected_at");
CREATE UNIQUE INDEX IF NOT EXISTS "simops_conflicts_tenant_fingerprint_unique"
  ON "simops_conflicts" ("tenant_id", "fingerprint");

CREATE TABLE IF NOT EXISTS "conflict_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "conflict_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "participant_role" varchar(16) NOT NULL,
  "is_frozen" boolean DEFAULT false NOT NULL,
  CONSTRAINT "conflict_participants_role_check"
    CHECK ("participant_role" IN ('newer', 'older', 'peer')),
  CONSTRAINT "conflict_participants_conflict_id_simops_conflicts_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE,
  CONSTRAINT "conflict_participants_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "conflict_participants_conflict_id_idx"
  ON "conflict_participants" ("conflict_id");
CREATE INDEX IF NOT EXISTS "conflict_participants_permit_id_idx"
  ON "conflict_participants" ("permit_id");
CREATE UNIQUE INDEX IF NOT EXISTS "conflict_participants_conflict_permit_unique"
  ON "conflict_participants" ("conflict_id", "permit_id");

CREATE TABLE IF NOT EXISTS "conflict_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "conflict_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "recipient_user_id" uuid,
  "recipient_role" varchar(64),
  "channel" varchar(16) NOT NULL,
  "delivery_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "message" text,
  "sent_at" timestamp with time zone,
  "acknowledged_at" timestamp with time zone,
  CONSTRAINT "conflict_alerts_channel_check"
    CHECK ("channel" IN ('in_app', 'push', 'email')),
  CONSTRAINT "conflict_alerts_delivery_status_check"
    CHECK ("delivery_status" IN ('pending', 'sent', 'failed', 'acknowledged')),
  CONSTRAINT "conflict_alerts_conflict_id_simops_conflicts_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "conflict_alerts_conflict_id_idx"
  ON "conflict_alerts" ("conflict_id");
CREATE INDEX IF NOT EXISTS "conflict_alerts_tenant_delivery_status_idx"
  ON "conflict_alerts" ("tenant_id", "delivery_status");
CREATE INDEX IF NOT EXISTS "conflict_alerts_recipient_user_id_idx"
  ON "conflict_alerts" ("recipient_user_id");
