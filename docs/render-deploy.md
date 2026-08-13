# Render demo deploy

Hosts the full stack on [Render](https://render.com) via `render.yaml`.

## Prerequisites

1. [Render account](https://dashboard.render.com/register)
2. GitHub connected to Render (repo can stay **private**)
3. Card may be required — Postgres (`basic-256mb`) + Starter web services are paid; Redis free tier where available

## Deploy

1. Push `render.yaml` to `main` on GitHub
2. Render Dashboard → **New** → **Blueprint**
3. Select `ramgandhe/great-ptw-loto-ai-app`
4. Confirm services → **Apply**
5. Wait for all services to go **Live** (first build 15–25 min)

## URLs

| Service | URL |
|---------|-----|
| Web | https://ptw-loto-web.onrender.com |
| API | https://ptw-loto-api.onrender.com |
| Auth | https://ptw-loto-auth.onrender.com |

**Login:** `admin@ptw.local` / `admin`

## After first deploy

1. Open **ptw-loto-auth** → Environment → copy `KEYCLOAK_ADMIN_PASSWORD`
2. If login redirect fails, from a machine that can reach Keycloak:

```bash
KEYCLOAK_ADMIN_URL=https://ptw-loto-auth.onrender.com \
KEYCLOAK_ADMIN_PASSWORD=<from Render> \
./scripts/demo-keycloak-redirect.sh https://ptw-loto-web.onrender.com
```

3. Create MinIO bucket once (API may create it; if uploads fail):

```bash
# MinIO console is not exposed separately; use mc against the public host if needed
```

## Notes

- Service names in `render.yaml` fix public hostnames — rename carefully
- Cold start on free/sleeping services can take ~60s
- Loki is not deployed; API logs to stdout (Render logs)

## Costs (approx)

Starter web × 4 + basic Postgres ≈ paid tier. Check [Render pricing](https://render.com/pricing) before applying.
