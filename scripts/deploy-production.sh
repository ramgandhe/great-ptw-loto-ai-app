#!/usr/bin/env bash
# Production deploy — run on the target host from the repository root.
#
# Prerequisites:
#   - Docker + Docker Compose v2
#   - Node.js 20+ (for forward-only migrations)
#   - DNS A/AAAA records for APP_DOMAIN, API_DOMAIN, AUTH_DOMAIN → this host
#   - `.env.production` filled from `.env.production.example` (never commit secrets)
#
# Usage:
#   cp .env.production.example .env.production   # first time only
#   ./scripts/deploy-production.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "$ENV_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.production.example and set real secrets." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required=(
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  MINIO_ACCESS_KEY
  MINIO_SECRET_KEY
  KEYCLOAK_ADMIN_PASSWORD
  DATABASE_URL
  CORS_ORIGIN
  NEXT_PUBLIC_API_URL
  NEXT_PUBLIC_APP_URL
  NEXT_PUBLIC_KEYCLOAK_URL
  APP_DOMAIN
  API_DOMAIN
  AUTH_DOMAIN
)

for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]] || [[ "${!key}" == CHANGE_ME* ]]; then
    echo "Set $key in $ENV_FILE before deploying." >&2
    exit 1
  fi
done

echo "==> Building production images"
"${COMPOSE[@]}" build --pull api frontend

echo "==> Starting infrastructure and application stack"
"${COMPOSE[@]}" up -d

echo "==> Waiting for API readiness"
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${API_PORT:-4000}/api/v1/health/ready" >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

if ! curl -fsS "http://127.0.0.1:${API_PORT:-4000}/api/v1/health/ready" >/dev/null; then
  echo "API did not become ready — check: ${COMPOSE[*]} logs api" >&2
  exit 1
fi

echo "==> Running forward-only database migrations"
MIGRATE_URL="${DATABASE_URL/@postgres:/@127.0.0.1:}"
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required on the host to run migrations." >&2
  exit 1
fi
npm ci --ignore-scripts
DATABASE_URL="$MIGRATE_URL" npm run db:migrate -w api

echo "==> Starting TLS reverse proxy (Caddy)"
docker compose -f infrastructure/production/docker-compose.caddy.yml --env-file "$ENV_FILE" up -d

echo "==> Smoke checks"
curl -fsS "http://127.0.0.1:${API_PORT:-4000}/api/v1/health" | head -c 120
echo
curl -fsS -o /dev/null -w "frontend_local:%{http_code}\n" "http://127.0.0.1:3000"

echo
echo "Production stack is up."
echo "  App:  https://${APP_DOMAIN}"
echo "  API:  https://${API_DOMAIN}/api/v1/health"
echo "  Auth: https://${AUTH_DOMAIN}"
