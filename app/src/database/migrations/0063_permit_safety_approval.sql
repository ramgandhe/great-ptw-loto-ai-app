ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "safety_approval_comment" text,
  ADD COLUMN IF NOT EXISTS "safety_approval_signed_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "safety_approved_by" uuid,
  ADD COLUMN IF NOT EXISTS "safety_approved_at" timestamptz;
