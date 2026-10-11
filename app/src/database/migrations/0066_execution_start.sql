ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "execution_start" jsonb NOT NULL DEFAULT '{}'::jsonb;
