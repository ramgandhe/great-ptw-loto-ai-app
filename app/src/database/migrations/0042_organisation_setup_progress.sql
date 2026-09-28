ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "setup_progress" jsonb NOT NULL DEFAULT '{}'::jsonb;
