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
