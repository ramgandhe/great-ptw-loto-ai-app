#!/bin/sh
set -eu

# Render sets PORT; Nest reads API_PORT.
export API_PORT="${PORT:-${API_PORT:-4000}}"

echo "==> Running migrations"
node app/dist/database/migrate.js

echo "==> Seeding demo data (idempotent)"
node app/dist/database/seed.js

echo "==> Starting API on :${API_PORT}"
exec node app/dist/main.js
