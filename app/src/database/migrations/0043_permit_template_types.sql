ALTER TABLE "permit_templates"
  ADD COLUMN IF NOT EXISTS "permit_type_ids" uuid[] NOT NULL DEFAULT '{}';
