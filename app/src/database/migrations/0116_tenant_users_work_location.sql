ALTER TABLE "tenant_users" ADD COLUMN IF NOT EXISTS "work_location_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_users_work_location_id_idx" ON "tenant_users" ("work_location_id");
--> statement-breakpoint

-- Backfill work_location_id from legacy department_id where matching work_location exists
UPDATE "tenant_users" tu
SET "work_location_id" = tu."department_id"
WHERE tu."work_location_id" IS NULL
  AND tu."department_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "work_locations" w WHERE w."id" = tu."department_id");
