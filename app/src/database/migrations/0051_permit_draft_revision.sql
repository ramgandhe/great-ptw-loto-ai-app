ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "draft_revision" integer NOT NULL DEFAULT 0;
