-- FR-PPL-004: one account per human (the Keycloak identity), holding person records in one or more tenants.
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_subject text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- FR-PPL-001: a person record has exactly one employer, a legal entity of its own tenant.
-- FR-PPL-005 (D31): email is the sign-in identity, required for every record linked to an account and never
-- deleted by a consent withdrawal; phone is an optional contact detail. A record with no account is crew-only.
CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  employer_legal_entity_id uuid NOT NULL,
  employment_type text NOT NULL CHECK (employment_type IN ('employee', 'contractor')),
  account_id uuid REFERENCES accounts (id),
  full_name text NOT NULL,
  email text CHECK (email = lower(email)),
  phone text,
  designation text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
  left_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, account_id),
  UNIQUE (tenant_id, email),
  FOREIGN KEY (tenant_id, employer_legal_entity_id) REFERENCES legal_entities (tenant_id, id),
  CONSTRAINT crew_only_people_have_no_account CHECK (email IS NOT NULL OR account_id IS NULL),
  CONSTRAINT left_people_have_a_date CHECK ((status = 'left') = (left_on IS NOT NULL))
);
SELECT app_apply_tenant_policy('people');

-- FR-PRV-005: contact details belong to the full record. The API role can select the assignment-card and
-- status columns only; contact details are read through app_person_contact by PersonalDataService (Task 14).
REVOKE SELECT ON people FROM ptw_api;
GRANT SELECT (id, tenant_id, employer_legal_entity_id, employment_type, account_id, full_name, designation,
              status, left_on, created_at, updated_at) ON people TO ptw_api;

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
-- A tenant sees an account only through a person record the account holds in that tenant.
-- No write policy: accounts are created at sign-in by a SECURITY DEFINER function (Phase 1b).
CREATE POLICY member_accounts_read ON accounts FOR SELECT
  USING ((SELECT app_context_valid())
         AND EXISTS (SELECT 1 FROM people p WHERE p.account_id = accounts.id AND p.tenant_id = app_tenant_id()));

-- Context validity now also requires a user's person to be an active person of the tenant.
CREATE OR REPLACE FUNCTION app_context_valid() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT app_context_complete() AND CASE app_acting_role()
    WHEN 'user' THEN app_tenant_id() IS NOT NULL
      AND cardinality(app_legal_entity_ids()) > 0
      AND NOT EXISTS (SELECT unnest(app_legal_entity_ids()) EXCEPT SELECT id FROM public.legal_entities WHERE tenant_id = app_tenant_id())
      AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = app_person_id() AND p.tenant_id = app_tenant_id() AND p.status = 'active')
    WHEN 'job' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NULL
      AND NOT EXISTS (SELECT unnest(app_legal_entity_ids()) EXCEPT SELECT id FROM public.legal_entities WHERE tenant_id = app_tenant_id())
    WHEN 'platform_admin' THEN app_tenant_id() IS NULL AND app_person_id() IS NULL AND cardinality(app_legal_entity_ids()) = 0
    ELSE false
  END
$$;
