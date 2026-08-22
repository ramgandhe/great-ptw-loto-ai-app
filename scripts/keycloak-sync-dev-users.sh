#!/usr/bin/env bash
# Sync dev users + roles from infrastructure/keycloak/realm-export.json into a
# running Keycloak instance (import only runs on first boot).
#
# Usage: ./scripts/keycloak-sync-dev-users.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT="${ROOT_DIR}/infrastructure/keycloak/realm-export.json"

KEYCLOAK_URL="${KEYCLOAK_URL:-http://127.0.0.1:8080}"
REALM="${KEYCLOAK_REALM:-ptw-platform}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
TENANT_ID="00000000-0000-4000-8000-000000000001"

command -v jq >/dev/null 2>&1 || { echo "jq is required." >&2; exit 1; }

log() { echo "==> $*"; }

TOKEN="$(curl -fsS -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=${ADMIN_USER}" \
  -d "password=${ADMIN_PASS}" \
  -d "grant_type=password" | jq -r '.access_token')"

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "Failed to obtain Keycloak admin token." >&2
  exit 1
fi

auth_header() {
  printf 'Authorization: Bearer %s' "$TOKEN"
}

ensure_role() {
  local role="$1"
  local status
  status="$(curl -s -o /dev/null -w '%{http_code}' \
    -H "$(auth_header)" \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role}")"
  if [[ "$status" == "404" ]]; then
    log "Creating role: ${role}"
    curl -fsS -X POST \
      -H "$(auth_header)" \
      -H 'Content-Type: application/json' \
      -d "$(jq -n --arg name "$role" '{name: $name}')" \
      "${KEYCLOAK_URL}/admin/realms/${REALM}/roles" >/dev/null
  fi
}

find_user_id() {
  local username="$1"
  curl -fsS -G \
    -H "$(auth_header)" \
    --data-urlencode "username=${username}" \
    --data-urlencode "exact=true" \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/users" | jq -r '.[0].id // empty'
}

upsert_user() {
  local username="$1"
  local email="$2"
  local first="$3"
  local last="$4"
  local password="$5"
  shift 5
  local roles=("$@")

  local user_id
  user_id="$(find_user_id "$username")"

  local payload
  payload="$(jq -n \
    --arg username "$username" \
    --arg email "$email" \
    --arg first "$first" \
    --arg last "$last" \
    --arg tenant "$TENANT_ID" \
    --arg id "$(jq -r --arg u "$username" '.users[] | select(.username == $u) | .id // empty' "$EXPORT")" \
    '{
      id: (if $id == "" then null else $id end),
      username: $username,
      email: $email,
      firstName: $first,
      lastName: $last,
      enabled: true,
      emailVerified: true,
      attributes: { tenant_id: [$tenant] }
    } | if .id == null then del(.id) else . end')"

  if [[ -z "$user_id" ]]; then
    log "Creating user: ${username} (${email})"
    curl -fsS -X POST \
      -H "$(auth_header)" \
      -H 'Content-Type: application/json' \
      -d "$payload" \
      "${KEYCLOAK_URL}/admin/realms/${REALM}/users" >/dev/null
    user_id="$(find_user_id "$username")"
  else
    log "Updating user: ${username}"
    curl -fsS -X PUT \
      -H "$(auth_header)" \
      -H 'Content-Type: application/json' \
      -d "$payload" \
      "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user_id}" >/dev/null
  fi

  curl -fsS -X PUT \
    -H "$(auth_header)" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg value "$password" '{type:"password", value:$value, temporary:false}')" \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user_id}/reset-password" >/dev/null

  local role_payload="[]"
  for role in "${roles[@]}"; do
    ensure_role "$role"
    local role_json
    role_json="$(curl -fsS -H "$(auth_header)" \
      "${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${role}")"
    role_payload="$(jq -c --argjson role "$role_json" '. + [$role]' <<<"$role_payload")"
  done

  local current_roles
  current_roles="$(curl -fsS -H "$(auth_header)" \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user_id}/role-mappings/realm")"
  if [[ "$(jq 'length' <<<"$current_roles")" -gt 0 ]]; then
    curl -fsS -X DELETE \
      -H "$(auth_header)" \
      -H 'Content-Type: application/json' \
      -d "$current_roles" \
      "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user_id}/role-mappings/realm" >/dev/null
  fi

  curl -fsS -X POST \
    -H "$(auth_header)" \
    -H 'Content-Type: application/json' \
    -d "$role_payload" \
    "${KEYCLOAK_URL}/admin/realms/${REALM}/users/${user_id}/role-mappings/realm" >/dev/null
}

log "Ensuring realm roles"
while IFS= read -r role; do
  [[ -n "$role" ]] && ensure_role "$role"
done < <(jq -r '.roles.realm[].name' "$EXPORT")

log "Syncing users"
while IFS=$'\t' read -r username email first last password roles_csv; do
  IFS=',' read -r -a roles <<<"$roles_csv"
  upsert_user "$username" "$email" "$first" "$last" "$password" "${roles[@]}"
done < <(jq -r '.users[] | [
  .username,
  .email,
  .firstName,
  .lastName,
  .credentials[0].value,
  (.realmRoles | join(","))
] | @tsv' "$EXPORT")

log "Done. Dev logins synced from realm-export.json"
