#!/usr/bin/env bash
# Add a web redirect URI to the ptw-web Keycloak client (demo / tunnel use).
set -euo pipefail

WEB_URL="${1:?Usage: demo-keycloak-redirect.sh <web-base-url>}"
REDIRECT="${WEB_URL%/}/callback"
REDIRECT_WILDCARD="${WEB_URL%/}/*"
KEYCLOAK_BASE="${KEYCLOAK_ADMIN_URL:-http://127.0.0.1:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM="${KEYCLOAK_REALM:-ptw-platform}"
CLIENT_ID="${KEYCLOAK_WEB_CLIENT:-ptw-web}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

TOKEN="$(curl -fsS -X POST "${KEYCLOAK_BASE}/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=${ADMIN_USER}" \
  -d "password=${ADMIN_PASS}" \
  -d "grant_type=password" | jq -r '.access_token')"

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "Failed to obtain Keycloak admin token." >&2
  exit 1
fi

CLIENT_UUID="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" \
  "${KEYCLOAK_BASE}/admin/realms/${REALM}/clients?clientId=${CLIENT_ID}" | jq -r '.[0].id')"

CLIENT_JSON="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" \
  "${KEYCLOAK_BASE}/admin/realms/${REALM}/clients/${CLIENT_UUID}")"

UPDATED="$(echo "$CLIENT_JSON" | jq \
  --arg redirect "${REDIRECT}" \
  --arg wildcard "${REDIRECT_WILDCARD}" \
  --arg origin "${WEB_URL%/}" \
  '.redirectUris = ((.redirectUris // []) + [$redirect, $wildcard] | unique)
   | .webOrigins = ((.webOrigins // []) + [$origin, "+"] | unique)')"

curl -fsS -X PUT -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$UPDATED" \
  "${KEYCLOAK_BASE}/admin/realms/${REALM}/clients/${CLIENT_UUID}" >/dev/null

echo "Keycloak client ${CLIENT_ID}: added redirect ${REDIRECT}"
