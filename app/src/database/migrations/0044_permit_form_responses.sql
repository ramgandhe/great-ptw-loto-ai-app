ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "form_responses" jsonb NOT NULL DEFAULT '[]'::jsonb;
