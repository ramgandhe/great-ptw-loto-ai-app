ALTER TABLE "permit_lototo_instances"
  ADD COLUMN IF NOT EXISTS "started_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "started_by" uuid,
  ADD COLUMN IF NOT EXISTS "crew_completed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "crew_completed_by" uuid;
