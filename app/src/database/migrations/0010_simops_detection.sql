CREATE TABLE IF NOT EXISTS "simops_conflicts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'open' NOT NULL,
  "severity" varchar(16) NOT NULL,
  "conflict_type" varchar(32) NOT NULL,
  "summary" varchar(512) NOT NULL,
  "details" jsonb,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "fingerprint" varchar(128) NOT NULL,
  CONSTRAINT "simops_conflicts_status_check"
    CHECK ("status" IN ('open', 'resolved')),
  CONSTRAINT "simops_conflicts_severity_check"
    CHECK ("severity" IN ('low', 'medium', 'high')),
  CONSTRAINT "simops_conflicts_type_check"
    CHECK ("conflict_type" IN ('location', 'equipment', 'schedule', 'permit_type'))
);

CREATE INDEX IF NOT EXISTS "simops_conflicts_tenant_id_idx"
  ON "simops_conflicts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "simops_conflicts_tenant_status_idx"
  ON "simops_conflicts" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "simops_conflicts_severity_idx"
  ON "simops_conflicts" ("severity");
CREATE UNIQUE INDEX IF NOT EXISTS "simops_conflicts_tenant_fingerprint_unique"
  ON "simops_conflicts" ("tenant_id", "fingerprint");

CREATE TABLE IF NOT EXISTS "conflict_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  CONSTRAINT "conflict_participants_conflict_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE,
  CONSTRAINT "conflict_participants_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
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
  "tenant_id" uuid NOT NULL,
  "conflict_id" uuid NOT NULL,
  "severity" varchar(16) NOT NULL,
  "message" text NOT NULL,
  "channel" varchar(32) DEFAULT 'in_app' NOT NULL,
  "recipient_role" varchar(64) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "acknowledged_at" timestamp with time zone,
  CONSTRAINT "conflict_alerts_conflict_id_fk"
    FOREIGN KEY ("conflict_id") REFERENCES "simops_conflicts"("id") ON DELETE CASCADE,
  CONSTRAINT "conflict_alerts_severity_check"
    CHECK ("severity" IN ('low', 'medium', 'high')),
  CONSTRAINT "conflict_alerts_status_check"
    CHECK ("status" IN ('pending', 'delivered', 'acknowledged'))
);

CREATE INDEX IF NOT EXISTS "conflict_alerts_tenant_id_idx"
  ON "conflict_alerts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "conflict_alerts_conflict_id_idx"
  ON "conflict_alerts" ("conflict_id");
CREATE INDEX IF NOT EXISTS "conflict_alerts_status_idx"
  ON "conflict_alerts" ("status");
