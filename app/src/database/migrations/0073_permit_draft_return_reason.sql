ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "draft_return_reason" text;
