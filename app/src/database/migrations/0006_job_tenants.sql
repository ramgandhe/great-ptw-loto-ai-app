-- NFR-SEC-008: the single source of tenant IDs for jobs that span tenants. Each tenant is then processed
-- under its own context with the API role; no job uses a bypass role for tenant data.
CREATE FUNCTION app_tenant_ids_for_jobs() RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$ SELECT id FROM public.organisations ORDER BY id $$;
REVOKE EXECUTE ON FUNCTION app_tenant_ids_for_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_tenant_ids_for_jobs() TO ptw_api;
