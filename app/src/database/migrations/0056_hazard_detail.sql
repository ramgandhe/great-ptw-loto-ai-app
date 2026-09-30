ALTER TABLE "hazard_categories"
  ADD COLUMN IF NOT EXISTS "category" varchar(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "consequences" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "controls" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "permit_hazards"
  ADD COLUMN IF NOT EXISTS "extra_consequences" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "extra_controls" jsonb NOT NULL DEFAULT '[]'::jsonb;
