ALTER TABLE "lototo_plans" ALTER COLUMN "permit_id" DROP NOT NULL;

ALTER TABLE "permits" ADD COLUMN IF NOT EXISTS "lototo_required" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "permit_lototo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "lototo_plan_id" uuid NOT NULL REFERENCES "lototo_plans"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_lototo_permit_plan_unique" ON "permit_lototo" ("permit_id", "lototo_plan_id");
CREATE INDEX IF NOT EXISTS "permit_lototo_permit_id_idx" ON "permit_lototo" ("permit_id");
CREATE INDEX IF NOT EXISTS "lototo_plans_machinery_id_idx" ON "lototo_plans" ("machinery_id");

UPDATE "tenant_users" SET "role" = 'tenant-owner' WHERE "role" = 'org-admin';
UPDATE "workflow_steps" SET "approver_role" = 'tenant-admin' WHERE "approver_role" = 'org-admin';

DROP TRIGGER IF EXISTS lototo_plans_require_permit ON "lototo_plans";
CREATE OR REPLACE FUNCTION enforce_lototo_plan_permit_exists()
RETURNS trigger AS $$
DECLARE
  permit_count integer;
BEGIN
  IF NEW."permit_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO permit_count FROM "permits" WHERE "id" = NEW."permit_id";

  IF permit_count = 0 THEN
    RAISE EXCEPTION 'lototo_plans require an existing permit';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lototo_plans_require_permit
  BEFORE INSERT OR UPDATE ON "lototo_plans"
  FOR EACH ROW EXECUTE FUNCTION enforce_lototo_plan_permit_exists();
