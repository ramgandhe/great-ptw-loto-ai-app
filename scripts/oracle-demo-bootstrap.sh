#!/usr/bin/env bash
# Oracle Cloud Free Tier — one-shot demo deploy (Ubuntu 22.04/24.04 ARM recommended).
#
# Run ON the Oracle VM:
#   curl -fsSL https://raw.githubusercontent.com/ramgandhe/great-ptw-loto-ai-app/main/scripts/oracle-demo-bootstrap.sh | sudo bash
#
# Or with a feature branch:
#   sudo BRANCH=mundadariddhii/ms-09-remediation bash oracle-demo-bootstrap.sh
#
# Before running, open Oracle ingress rules (VCN security list) for TCP: 22, 3000, 4000, 8080.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ramgandhe/great-ptw-loto-ai-app.git}"
APP_DIR="${APP_DIR:-/opt/ptw-demo}"
BRANCH="${BRANCH:-main}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

log() { echo "==> $*"; }

log "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git jq

if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin missing." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  log "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

TOTAL_MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [[ "$TOTAL_MEM_MB" -lt 8192 ]] && [[ ! -f /swapfile ]]; then
  log "Adding 4G swap (RAM is ${TOTAL_MEM_MB}MB)"
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Cloning ${REPO_URL} (${BRANCH})"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH" || git -C "$APP_DIR" reset --hard "origin/${BRANCH}"
else
  rm -rf "$APP_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
chmod +x scripts/*.sh

PUBLIC_IP="${PUBLIC_IP:-}"
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP="$(curl -fsSL -H 'Authorization: Bearer Oracle' http://169.254.169.254/opc/v2/instance/ 2>/dev/null | jq -r '.primaryPublicIp // empty' || true)"
fi
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP="$(curl -fsS -4 --max-time 5 ifconfig.me 2>/dev/null || true)"
fi
if [[ -z "$PUBLIC_IP" ]]; then
  echo "Could not detect public IP. Re-run: PUBLIC_IP=x.x.x.x ./scripts/demo-quick.sh" >&2
  exit 1
fi

log "Public IP: $PUBLIC_IP"

export DEMO_WEB_URL="http://${PUBLIC_IP}:3000"
export DEMO_API_URL="http://${PUBLIC_IP}:4000/api/v1"
export DEMO_AUTH_URL="http://${PUBLIC_IP}:8080"

log "Starting infrastructure (Postgres, Redis, MinIO, Keycloak, Loki)"
docker compose up -d postgres redis minio keycloak loki

log "Waiting for Postgres"
for _ in $(seq 1 40); do
  if docker compose exec -T postgres pg_isready -U ptw -d ptw_platform >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

log "Waiting for Keycloak (can take 2–3 min on first boot)"
for _ in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:8080 >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

log "Building API + frontend with public demo URLs"
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build api frontend

log "Waiting for API readiness"
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:4000/api/v1/health/ready >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

if ! curl -fsS http://127.0.0.1:4000/api/v1/health/ready >/dev/null 2>&1; then
  echo "API not ready. Check: docker compose logs api" >&2
  exit 1
fi

log "Database migrate + seed"
cp -n .env.example .env
npm ci --ignore-scripts
npm run db:migrate -w api
npm run db:seed -w api

log "Registering Keycloak redirect for demo login"
./scripts/demo-keycloak-redirect.sh "$DEMO_WEB_URL"

cat <<EOF

==============================================
  Demo URL:  ${DEMO_WEB_URL}
  Login:     admin@ptw.local / admin
==============================================

If the link does not load from another device:
  1. Oracle Console → Networking → VCN → Security List
  2. Add ingress: TCP 3000, 4000, 8080 from 0.0.0.0/0
  3. Check the instance has a public IP assigned

EOF
