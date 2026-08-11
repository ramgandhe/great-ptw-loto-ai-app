-- PUS-243 / SP-09.01 — Role authority remediation (FR-ROL-001, FR-ROL-004)
-- Extends approval_history actions for distinct HOD initial-review entries
-- and adds immutable supervisor co-signature records linked to executor sources.

ALTER TABLE "approval_history" DROP CONSTRAINT IF EXISTS "approval_history_action_check";
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_action_check"
  CHECK ("action" IN (
    'submitted',
    'approved',
    'rejected',
    'deferred',
    'stage_advanced',
    'resubmitted',
    'hod_initial_review',
    'supervisor_cosign'
  ));

CREATE TABLE IF NOT EXISTS "supervisor_cosignatures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "source_entity_type" varchar(64) NOT NULL,
  "source_entity_id" uuid NOT NULL,
  "supervisor_id" uuid NOT NULL,
  "comment" text,
  "signed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "supervisor_cosignatures_source_type_check"
    CHECK ("source_entity_type" IN (
      'permit_progress',
      'permit_evidence',
      'permit_daily_progress',
      'lototo_checklist'
    )),
  CONSTRAINT "supervisor_cosignatures_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "supervisor_cosignatures_unique"
  ON "supervisor_cosignatures" ("tenant_id", "source_entity_type", "source_entity_id", "supervisor_id");
CREATE INDEX IF NOT EXISTS "supervisor_cosignatures_permit_id_idx"
  ON "supervisor_cosignatures" ("permit_id");
CREATE INDEX IF NOT EXISTS "supervisor_cosignatures_source_idx"
  ON "supervisor_cosignatures" ("source_entity_type", "source_entity_id");

CREATE OR REPLACE FUNCTION prevent_supervisor_cosignature_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'supervisor_cosignatures records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supervisor_cosignatures_immutable ON "supervisor_cosignatures";
CREATE TRIGGER supervisor_cosignatures_immutable
  BEFORE UPDATE OR DELETE ON "supervisor_cosignatures"
  FOR EACH ROW EXECUTE FUNCTION prevent_supervisor_cosignature_mutation();
