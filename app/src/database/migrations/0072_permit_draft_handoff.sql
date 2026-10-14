ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "draft_holder" varchar(32) NOT NULL DEFAULT 'receiver';
ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "draft_held_by" uuid;
