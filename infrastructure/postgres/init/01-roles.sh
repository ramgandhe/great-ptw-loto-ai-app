#!/bin/bash
# Runs once, on an empty data volume, as the bootstrap superuser (postgres image entrypoint).
# NFR-SEC-001a: migrations own the schema; the API connects as a role that owns nothing and cannot
# bypass row-level security; Keycloak has its own database and role.
set -euo pipefail
: "${PTW_OWNER_PASSWORD:?}" "${PTW_API_PASSWORD:?}" "${KEYCLOAK_DB_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_pw="$PTW_OWNER_PASSWORD" -v api_pw="$PTW_API_PASSWORD" -v kc_pw="$KEYCLOAK_DB_PASSWORD" <<'SQL'
CREATE ROLE ptw_owner LOGIN NOSUPERUSER BYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD :'owner_pw';
CREATE ROLE ptw_api LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD :'api_pw';
CREATE ROLE keycloak LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB PASSWORD :'kc_pw';
CREATE DATABASE ptw_platform OWNER ptw_owner;
CREATE DATABASE keycloak OWNER keycloak;
REVOKE CONNECT, TEMPORARY ON DATABASE ptw_platform FROM PUBLIC;
REVOKE CONNECT, TEMPORARY ON DATABASE keycloak FROM PUBLIC;
GRANT CONNECT ON DATABASE ptw_platform TO ptw_api;
\connect ptw_platform
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SQL
