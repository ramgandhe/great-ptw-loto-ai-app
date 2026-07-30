# API reference

Base path: `/api/v1`

## Platform

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | Public | Service health |
| GET | `/system/config` | Public | Client config |
| GET | `/system/version` | Public | Version |

## AI

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/ai/health` | Public | Retriever/cache/guard status |
| POST | `/ai/query` | Required | RAG query body `{ query, conversationId?, permitId? }` |

PTW permit/approval/execution/closure routes remain under their existing controllers.
