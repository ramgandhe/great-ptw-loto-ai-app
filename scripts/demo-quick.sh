#!/usr/bin/env bash
# Quick public demo on a VPS (or any host with a public IP).
#
# 1. Open firewall: 3000, 4000, 8080
# 2. Ensure infrastructure is up (postgres, redis, minio, keycloak)
# 3. Run: ./scripts/demo-quick.sh 203.0.113.10
#
# Share: http://<ip>:3000
# Login: admin@ptw.local / admin

set -euo pipefail

HOST="${1:?Usage: ./scripts/demo-quick.sh <public-ip-or-hostname>}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export DEMO_WEB_URL="http://${HOST}:3000"
export DEMO_API_URL="http://${HOST}:4000/api/v1"
export DEMO_AUTH_URL="http://${HOST}:8080"

echo "==> Demo URLs"
echo "    Web:  $DEMO_WEB_URL"
echo "    API:  $DEMO_API_URL"
echo "    Auth: $DEMO_AUTH_URL"

echo "==> Rebuilding api + frontend for public demo"
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build api frontend

echo "==> Waiting for API"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:4000/api/v1/health/ready" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Registering Keycloak redirect URI for demo web URL"
"$ROOT_DIR/scripts/demo-keycloak-redirect.sh" "$DEMO_WEB_URL"

echo
echo "Demo ready — share: $DEMO_WEB_URL"
echo "Login: admin@ptw.local / admin"
