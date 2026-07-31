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

## SIMOPS (Conflict Detection)

| Method | Path | Auth | Roles | Notes |
| --- | --- | --- | --- | --- |
| GET | `/simops/conflicts` | Required | job-issuer, supervisor, org-admin, platform-admin, viewer | List tenant conflicts; query `status`, `severity`, `permitId` |
| GET | `/simops/conflicts/:id` | Required | same as list | Conflict detail with participants and alerts |
| POST | `/simops/analyse` | Required | supervisor, org-admin, platform-admin | Trigger pairwise analysis; optional body `{ permitId? }` |
| GET | `/simops/alerts` | Required | job-issuer, supervisor, org-admin, platform-admin, viewer | List alerts; query `deliveryStatus` |

Conflict assessment / mitigation / approve / reject endpoints are delivered in SP-04.02.
