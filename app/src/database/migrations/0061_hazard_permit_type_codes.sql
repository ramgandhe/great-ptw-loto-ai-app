ALTER TABLE "hazard_categories"
  ADD COLUMN IF NOT EXISTS "permit_type_codes" varchar(16)[] NOT NULL DEFAULT '{}';
