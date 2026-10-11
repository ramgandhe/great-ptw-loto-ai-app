ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "emergency_phone" varchar(32);
