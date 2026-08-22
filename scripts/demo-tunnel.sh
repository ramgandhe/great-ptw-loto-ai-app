#!/usr/bin/env bash
# Expose the local Docker stack for a remote demo via Cloudflare Tunnel (free).
# Requires: cloudflared (`brew install cloudflared`)
#
# Usage: ./scripts/demo-tunnel.sh
#
# Prints a shareable HTTPS URL for the web app. API + Keycloak get matching tunnel URLs.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Install cloudflared first: brew install cloudflared" >&2
  exit 1
fi

if ! curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then
  echo "Web app not reachable on :3000 — start the stack first:" >&2
  echo "  docker compose -f docker-compose.app.yml up -d --build" >&2
  exit 1
fi

start_tunnel() {
  local port="$1"
  local label="$2"
  local log
  log="$(mktemp)"
  cloudflared tunnel --url "http://127.0.0.1:${port}" >"$log" 2>&1 &
  local pid=$!
  local url=""
  for _ in $(seq 1 60); do
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$log" | head -1 || true)"
    if [[ -n "$url" ]]; then
      break
    fi
    sleep 1
  done
  if [[ -z "$url" ]]; then
    kill "$pid" 2>/dev/null || true
    echo "Failed to start ${label} tunnel. Log:" >&2
    cat "$log" >&2
    exit 1
  fi
  echo "$label|$url|$pid|$log"
}

echo "==> Starting Cloudflare quick tunnels (3)…"
WEB_INFO="$(start_tunnel 3000 web)"
API_INFO="$(start_tunnel 4000 api)"
AUTH_INFO="$(start_tunnel 8080 auth)"

parse_field() { echo "$1" | cut -d'|' -f"$2"; }
WEB_URL="$(parse_field "$WEB_INFO" 2)"
API_URL="$(parse_field "$API_INFO" 2)"
AUTH_URL="$(parse_field "$AUTH_INFO" 2)"
WEB_PID="$(parse_field "$WEB_INFO" 3)"
API_PID="$(parse_field "$API_INFO" 3)"
AUTH_PID="$(parse_field "$AUTH_INFO" 3)"

export DEMO_WEB_URL="$WEB_URL"
export DEMO_API_URL="${API_URL}/api/v1"
export DEMO_AUTH_URL="$AUTH_URL"

echo "    Web:  $DEMO_WEB_URL"
echo "    API:  $DEMO_API_URL"
echo "    Auth: $DEMO_AUTH_URL"

echo "==> Rebuilding frontend for tunnel URLs"
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build api frontend

echo "==> Updating Keycloak redirect"
chmod +x "$ROOT_DIR/scripts/demo-keycloak-redirect.sh"
"$ROOT_DIR/scripts/demo-keycloak-redirect.sh" "$DEMO_WEB_URL"

TUNNEL_PID_FILE="$ROOT_DIR/.demo-tunnel.pids"
cat >"$TUNNEL_PID_FILE" <<EOF
WEB_PID=$WEB_PID
API_PID=$API_PID
AUTH_PID=$AUTH_PID
WEB_URL=$DEMO_WEB_URL
API_URL=$DEMO_API_URL
AUTH_URL=$DEMO_AUTH_URL
EOF

echo
echo "=========================================="
echo "  Share this link: $DEMO_WEB_URL"
echo "  Login: admin@ptw.local / admin"
echo "=========================================="
echo
echo "Tunnels run until you stop them:"
echo "  kill \$(cut -d= -f2 $TUNNEL_PID_FILE | tr '\\n' ' ')"
