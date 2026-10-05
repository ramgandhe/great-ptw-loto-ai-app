#!/usr/bin/env bash
# Runs the API Jest suite against a throwaway PostgreSQL 16, so runs never share or grow a database.
#
# Starts postgres:16-alpine on 127.0.0.1:${PTW_TEST_PG_PORT:-55432} (loopback only), initialised by this
# branch's infrastructure/postgres/init (roles ptw_owner, ptw_api, keycloak; database ptw_platform), waits
# until it is ready, then runs `npm run test -w api -- --maxWorkers=2 "$@"` against it. The container is
# removed on exit, failure, Ctrl-C and SIGTERM. The container and its anonymous data volume are both removed (rm -v), so nothing is left behind.
#
# Redis (:6379) and OpenBao (:8200) are not started here; the Jest global setup fails clearly without them
# (docker compose up -d redis openbao openbao-init). The passwords are throwaway values for this container
# only. No .env file is read.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

port="${PTW_TEST_PG_PORT:-55432}"
name="ptw-test-pg-$$"
ptw_pw=test_ptw_pw owner_pw=test_owner_pw api_pw=test_api_pw keycloak_pw=test_keycloak_pw

trap 'docker rm -fv "$name" >/dev/null 2>&1 || true' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# No POSTGRES_DB: 01-roles.sh creates ptw_platform itself and fails if it already exists.
# No --rm: if init fails, the container must outlive it so the logs below can be printed. The EXIT trap removes it.
docker run -d --name "$name" \
  -p "127.0.0.1:$port:5432" \
  -v "$PWD/infrastructure/postgres/init:/docker-entrypoint-initdb.d:ro" \
  -e POSTGRES_USER=ptw -e POSTGRES_PASSWORD="$ptw_pw" \
  -e PTW_OWNER_PASSWORD="$owner_pw" -e PTW_API_PASSWORD="$api_pw" -e KEYCLOAK_DB_PASSWORD="$keycloak_pw" \
  postgres:16-alpine >/dev/null

# The entrypoint restarts the server after init. Only the final server listens on TCP, so probe 127.0.0.1
# inside the container (a bare pg_isready or a socket probe can pass against the init-time server).
ready=
for _ in $(seq 60); do
  docker exec -e PGPASSWORD="$ptw_pw" "$name" psql -h 127.0.0.1 -U ptw -d ptw_platform -Atc \
    "select 1 from pg_roles where rolname='ptw_api'" 2>/dev/null | grep -qx 1 && ready=1 && break
  sleep 1
done
if [ -z "$ready" ]; then
  echo "test-api-fresh: PostgreSQL in $name was not ready after 60 s (init failed?)" >&2
  docker logs --tail 20 "$name" >&2 || true
  exit 1
fi

target="127.0.0.1:$port/ptw_platform"
export DATABASE_URL="postgresql://ptw_api:$api_pw@$target"
export MIGRATION_DATABASE_URL="postgresql://ptw_owner:$owner_pw@$target"
export POSTGRES_SUPERUSER_URL="postgresql://ptw:$ptw_pw@$target"

npm run test -w api -- --maxWorkers=2 "$@"
