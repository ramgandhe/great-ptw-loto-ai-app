ALTER TABLE "permits" DROP CONSTRAINT IF EXISTS "permits_status_check";
ALTER TABLE "permits" ADD CONSTRAINT "permits_status_check"
  CHECK ("status" IN (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'deferred',
    'active',
    'suspended',
    'pending_closure',
    'closed',
    'expired',
    'cancelled'
  ));

ALTER TABLE "permit_status_history" DROP CONSTRAINT IF EXISTS "permit_status_history_action_check";
ALTER TABLE "permit_status_history" ADD CONSTRAINT "permit_status_history_action_check"
  CHECK ("action" IN ('activated', 'suspended', 'resumed', 'verified', 'closed', 'cancelled'));

ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "incidents_status_check";
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_status_check"
  CHECK ("status" IN (
    'draft',
    'open',
    'pending_hod_decision',
    'investigating',
    'pending_verification',
    'verified',
    'closed'
  ));

CREATE TABLE IF NOT EXISTS "incident_hod_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL,
  "decision" varchar(16) NOT NULL,
  "decided_by" uuid NOT NULL,
  "comment" text,
  CONSTRAINT "incident_hod_decisions_incident_id_incidents_id_fk"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE,
  CONSTRAINT "incident_hod_decisions_decision_check"
    CHECK ("decision" IN ('continue', 'stop'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "incident_hod_decisions_incident_unique"
  ON "incident_hod_decisions" ("incident_id");
CREATE INDEX IF NOT EXISTS "incident_hod_decisions_tenant_id_idx"
  ON "incident_hod_decisions" ("tenant_id");
