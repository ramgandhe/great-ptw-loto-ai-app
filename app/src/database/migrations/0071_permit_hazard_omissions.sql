ALTER TABLE "permit_hazards"
  ADD COLUMN IF NOT EXISTS "omitted_consequences" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "permit_hazards"
  ADD COLUMN IF NOT EXISTS "omitted_controls" jsonb NOT NULL DEFAULT '[]'::jsonb;
