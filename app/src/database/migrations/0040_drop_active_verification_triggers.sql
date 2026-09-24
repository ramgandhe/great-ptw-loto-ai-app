DROP TRIGGER IF EXISTS permit_verifications_requires_active ON "permit_verifications";
DROP TRIGGER IF EXISTS permit_verifications_require_active ON "permit_verifications";
DROP FUNCTION IF EXISTS enforce_permit_verification_on_active();
DROP FUNCTION IF EXISTS require_permit_verification_active();

CREATE OR REPLACE FUNCTION enforce_permit_closure_requirements()
RETURNS trigger AS $$
DECLARE
  permit_status varchar(32);
  verification_count integer;
BEGIN
  SELECT "status" INTO permit_status FROM "permits" WHERE "id" = NEW."permit_id";

  IF permit_status IS DISTINCT FROM 'pending_closure' THEN
    RAISE EXCEPTION 'permit_closures requires permit status pending_closure, got %', permit_status;
  END IF;

  SELECT COUNT(*) INTO verification_count
  FROM "permit_verifications"
  WHERE "permit_id" = NEW."permit_id";

  IF verification_count = 0 THEN
    RAISE EXCEPTION 'permit_closures requires prior verification';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
