ALTER TABLE "permits" DROP CONSTRAINT IF EXISTS "permits_status_check";
ALTER TABLE "permits" ADD CONSTRAINT "permits_status_check"
  CHECK ("status" IN (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'deferred',
    'active',
    'execution_completed',
    'suspended',
    'pending_closure',
    'closed',
    'expired',
    'cancelled'
  ));

ALTER TABLE "permit_status_history" DROP CONSTRAINT IF EXISTS "permit_status_history_action_check";
ALTER TABLE "permit_status_history" ADD CONSTRAINT "permit_status_history_action_check"
  CHECK ("action" IN (
    'activated',
    'suspended',
    'resumed',
    'revalidated',
    'verified',
    'execution_completed',
    'sent_back',
    'closed',
    'cancelled'
  ));

ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "department_id" uuid;

CREATE TABLE IF NOT EXISTS "permit_viewers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "workforce_user_id" uuid NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "permit_viewers_permit_user_unique" ON "permit_viewers" ("permit_id", "workforce_user_id");
CREATE INDEX IF NOT EXISTS "permit_viewers_permit_id_idx" ON "permit_viewers" ("permit_id");

CREATE TABLE IF NOT EXISTS "permit_safety_officers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "workforce_user_id" uuid NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "permit_safety_officers_permit_user_unique" ON "permit_safety_officers" ("permit_id", "workforce_user_id");
CREATE INDEX IF NOT EXISTS "permit_safety_officers_permit_id_idx" ON "permit_safety_officers" ("permit_id");

CREATE TABLE IF NOT EXISTS "permit_execution_completions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "completed_by" uuid NOT NULL,
  "completed_at" timestamptz DEFAULT now() NOT NULL,
  "comment" text NOT NULL,
  "checklist" jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "permit_execution_completions_permit_id_unique" ON "permit_execution_completions" ("permit_id");

ALTER TABLE "permit_closures" ADD COLUMN IF NOT EXISTS "checklist" jsonb;

DROP TRIGGER IF EXISTS permit_verifications_require_active ON "permit_verifications";
DROP TRIGGER IF EXISTS permit_closures_require_active ON "permit_closures";
DROP FUNCTION IF EXISTS require_permit_verification_active();
DROP FUNCTION IF EXISTS require_permit_closure_active();
