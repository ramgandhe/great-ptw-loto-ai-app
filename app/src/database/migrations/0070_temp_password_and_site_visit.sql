ALTER TABLE "tenant_users"
  ADD COLUMN IF NOT EXISTS "temporary_password" varchar(128);

ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "receiver_site_visited" boolean NOT NULL DEFAULT false;
ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "executor_site_visited" boolean NOT NULL DEFAULT false;
ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "safety_officer_site_visited" boolean NOT NULL DEFAULT false;
ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "approver_site_visited" boolean NOT NULL DEFAULT false;
