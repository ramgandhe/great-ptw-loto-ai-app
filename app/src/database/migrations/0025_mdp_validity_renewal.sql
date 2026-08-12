ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "timezone" varchar(64) DEFAULT 'UTC' NOT NULL;

ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "renewed_from_permit_id" uuid;

ALTER TABLE "permits" DROP CONSTRAINT IF EXISTS "permits_renewed_from_permit_id_fk";
ALTER TABLE "permits" ADD CONSTRAINT "permits_renewed_from_permit_id_fk"
  FOREIGN KEY ("renewed_from_permit_id") REFERENCES "permits"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "permits_renewed_from_permit_id_idx"
  ON "permits" ("renewed_from_permit_id");

ALTER TABLE "revalidation_history" DROP CONSTRAINT IF EXISTS "revalidation_history_event_type_check";
ALTER TABLE "revalidation_history" ADD CONSTRAINT "revalidation_history_event_type_check"
  CHECK ("event_type" IN (
    'revalidation_passed',
    'revalidation_failed',
    'permit_continued',
    'permit_suspended',
    'extension_requested',
    'extension_approved',
    'extension_rejected',
    'validity_expired',
    'renewal_due_notified',
    'renewal_initiated'
  ));
