ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "email" varchar(255);
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "phone" varchar(64);
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "gstin" varchar(32);
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "keycloak_user_id" varchar(128);
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "keycloak_user_id" varchar(128);
ALTER TABLE "contractors" ADD COLUMN IF NOT EXISTS "keycloak_user_id" varchar(128);
