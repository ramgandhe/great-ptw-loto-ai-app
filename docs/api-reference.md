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

PTW permit/approval/execution/closure/SIMOPS routes remain under their existing controllers.

## Multi-Day Daily Progress (MS-05 / SP-05.01)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/permits/{id}/daily-progress` | Required | Record daily progress (`operationalDate`, work summary) |
| GET | `/permits/{id}/daily-progress` | Required | List daily progress history |
| POST | `/permits/{id}/handover` | Required | Complete shift handover |
| GET | `/permits/{id}/handover` | Required | List handover history |
| GET | `/permits/{id}/daily-history` | Required | Append-only activity history |

