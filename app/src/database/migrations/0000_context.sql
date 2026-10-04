-- v2 foundation (PRD §16, §18). Runs as ptw_owner. The API connects as ptw_api, which owns nothing
-- and reaches rows only through the policies below (NFR-SEC-001a).

-- Context readers (NFR-SEC-008). runInContext always sets all four settings; 'none' is an explicitly empty
-- value. An unset or '' setting is missing, which app_context_complete() rejects.
CREATE FUNCTION app_tenant_id() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(nullif(current_setting('app.tenant_id', true), ''), 'none')::uuid $$;
CREATE FUNCTION app_person_id() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT nullif(nullif(current_setting('app.person_id', true), ''), 'none')::uuid $$;
CREATE FUNCTION app_legal_entity_ids() RETURNS uuid[] LANGUAGE sql STABLE
  AS $$ SELECT coalesce(string_to_array(nullif(nullif(current_setting('app.legal_entity_ids', true), ''), 'none'), ',')::uuid[], '{}'::uuid[]) $$;
CREATE FUNCTION app_acting_role() RETURNS text LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.acting_role', true), '') $$;

-- Every setting is present (a value or 'none'). A missing setting makes any context, user, job or platform, no context.
CREATE FUNCTION app_context_complete() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.tenant_id', true), '') <> ''
     AND coalesce(current_setting('app.person_id', true), '') <> ''
     AND coalesce(current_setting('app.legal_entity_ids', true), '') <> ''
     AND coalesce(current_setting('app.acting_role', true), '') <> ''
$$;

-- Whether the transaction's context is complete and fits its acting role. Every policy requires it, so a partial
-- context is no context (NFR-SEC-008). This first version checks shape; 0001 and 0002 replace it to also
-- check that the legal entities and the person belong to the tenant.
CREATE FUNCTION app_context_valid() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_context_complete() AND CASE app_acting_role()
    WHEN 'user' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NOT NULL AND cardinality(app_legal_entity_ids()) > 0
    WHEN 'job' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NULL
    WHEN 'platform_admin' THEN app_tenant_id() IS NULL AND app_person_id() IS NULL AND cardinality(app_legal_entity_ids()) = 0
    ELSE false
  END
$$;

-- Migration helper: ENABLE and FORCE RLS plus the standard tenant policy, for a table with tenant_id.
-- (SELECT app_context_valid()) is evaluated once per query, not per row.
CREATE FUNCTION app_apply_tenant_policy(tbl regclass) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s USING (tenant_id = app_tenant_id() AND (SELECT app_context_valid())) '
    'WITH CHECK (tenant_id = app_tenant_id() AND (SELECT app_context_valid()))', tbl);
END $$;
REVOKE EXECUTE ON FUNCTION app_apply_tenant_policy(regclass) FROM PUBLIC;

-- The API role gets row privileges on every table the owner creates; policies decide which rows.
GRANT USAGE ON SCHEMA public TO ptw_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ptw_api;

CREATE TABLE organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('organisation', 'agency')),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  name text NOT NULL,
  industry text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'active', 'read_only', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;
-- A tenant sees its own row. The platform admin sees every tenant's row (names, status, plans) and creates tenants.
CREATE POLICY organisation_read ON organisations FOR SELECT
  USING ((SELECT app_context_valid()) AND (id = app_tenant_id() OR app_acting_role() = 'platform_admin'));
CREATE POLICY organisation_create ON organisations FOR INSERT
  WITH CHECK ((SELECT app_context_valid()) AND app_acting_role() = 'platform_admin');
CREATE POLICY organisation_update ON organisations FOR UPDATE
  USING ((SELECT app_context_valid()) AND (id = app_tenant_id() OR app_acting_role() = 'platform_admin'))
  WITH CHECK ((SELECT app_context_valid()) AND (id = app_tenant_id() OR app_acting_role() = 'platform_admin'));
