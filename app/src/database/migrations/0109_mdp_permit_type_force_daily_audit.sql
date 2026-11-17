-- Slice J3: permit types may force daily revalidation ON for multi-day permits.

ALTER TABLE "permit_types"
  ADD COLUMN IF NOT EXISTS "force_daily_revalidation" boolean DEFAULT false NOT NULL;
