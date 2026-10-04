-- Whole-branch review fixes for Phase 1a. Runs as ptw_owner.

-- A tenant must not rewrite its own identity: the agency check (app_agency_covers_plant) reads organisations.kind,
-- and status and slug are the platform's to set. The UPDATE policy lets a tenant update its own row, so this trigger
-- narrows it: kind, status and slug change only under the platform admin's context.
CREATE FUNCTION app_organisation_identity_guard() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (NEW.kind, NEW.status, NEW.slug) IS DISTINCT FROM (OLD.kind, OLD.status, OLD.slug)
     AND app_acting_role() IS DISTINCT FROM 'platform_admin' THEN
    RAISE EXCEPTION 'only the platform admin can change an organisation''s kind, status or slug'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER organisations_identity_guard BEFORE UPDATE ON organisations
  FOR EACH ROW EXECUTE FUNCTION app_organisation_identity_guard();

-- Account links are made only by a SECURITY DEFINER function (Phase 1b sign-in), never by the API role directly:
-- a tenant that learned another account's id could otherwise attach it to its own person record.
REVOKE INSERT, UPDATE, DELETE ON accounts FROM ptw_api;
-- The API role writes every people column except account_id. DELETE stays as it was. A column added to people later
-- needs its own INSERT and UPDATE grants here, because column grants are not covered by the default privileges.
REVOKE INSERT, UPDATE ON people FROM ptw_api;
GRANT INSERT (id, tenant_id, employer_legal_entity_id, employment_type, full_name, email, phone, designation,
              status, left_on, created_at, updated_at) ON people TO ptw_api;
GRANT UPDATE (id, tenant_id, employer_legal_entity_id, employment_type, full_name, email, phone, designation,
              status, left_on, created_at, updated_at) ON people TO ptw_api;

-- FR-PPL-005 (D31): email is the sign-in identity. A NULL email (crew-only) still passes; '' and padded values do not.
ALTER TABLE people ADD CONSTRAINT people_email_trimmed CHECK (email = btrim(email) AND email <> '');
