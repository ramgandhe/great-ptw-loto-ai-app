# Deployment

## Local infrastructure

```bash
docker compose up -d postgres redis minio keycloak
npm install
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
```

## Full stack containers

```bash
docker compose up -d --build
```

API: `http://localhost:4000/api/v1/health`  
Web: `http://localhost:3000`  
Keycloak: `http://localhost:8080`
