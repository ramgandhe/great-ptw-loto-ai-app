ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "submitted_signed_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "approved_by" uuid,
  ADD COLUMN IF NOT EXISTS "approved_signed_name" varchar(255);
