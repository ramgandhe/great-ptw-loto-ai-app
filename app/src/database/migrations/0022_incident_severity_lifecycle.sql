-- PUS-244 / FR-INC-011 — structurally distinct near-miss vs accident severity lifecycle

CREATE TABLE IF NOT EXISTS "incident_severity_lifecycle" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
  "severity_path" varchar(32) NOT NULL,
  "lifecycle_status" varchar(32) NOT NULL,
  "hod_decision" varchar(16),
  "hod_decided_by" uuid,
  "hod_decided_at" timestamp with time zone,
  "hod_decision_comments" text,
  "permits_cancelled_at" timestamp with time zone,
  "applied_at" timestamp with time zone,
  CONSTRAINT "incident_severity_lifecycle_path_check"
    CHECK ("severity_path" IN ('near_miss', 'accident')),
  CONSTRAINT "incident_severity_lifecycle_status_check"
    CHECK ("lifecycle_status" IN ('awaiting_hod', 'continued', 'stopped', 'auto_terminated')),
  CONSTRAINT "incident_severity_lifecycle_hod_decision_check"
    CHECK ("hod_decision" IS NULL OR "hod_decision" IN ('continue', 'stop'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "incident_severity_lifecycle_incident_unique"
  ON "incident_severity_lifecycle" ("incident_id");
CREATE INDEX IF NOT EXISTS "incident_severity_lifecycle_tenant_status_idx"
  ON "incident_severity_lifecycle" ("tenant_id", "lifecycle_status");

CREATE TABLE IF NOT EXISTS "incident_severity_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
  "event_type" varchar(64) NOT NULL,
  "actor_id" uuid NOT NULL,
  "permit_id" uuid,
  "payload" jsonb,
  CONSTRAINT "incident_severity_history_event_type_check"
    CHECK ("event_type" IN (
      'path_opened',
      'hod_continue',
      'hod_stop',
      'accident_auto_terminated',
      'permit_cancelled'
    ))
);

CREATE INDEX IF NOT EXISTS "incident_severity_history_tenant_incident_idx"
  ON "incident_severity_history" ("tenant_id", "incident_id");
CREATE INDEX IF NOT EXISTS "incident_severity_history_incident_created_at_idx"
  ON "incident_severity_history" ("incident_id", "created_at");
