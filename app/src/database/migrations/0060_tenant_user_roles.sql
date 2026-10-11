ALTER TABLE "tenant_users"
  ADD COLUMN IF NOT EXISTS "roles" varchar(64)[] NOT NULL DEFAULT '{}';

UPDATE "tenant_users"
SET "roles" = ARRAY["role"]
WHERE "roles" = '{}' OR "roles" IS NULL;
