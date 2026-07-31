# API reference

Base path: `/api/v1`

## Platform

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | Public | Service health |
| GET | `/system/config` | Public | Client config |
| GET | `/system/version` | Public | Version |

Security notes (SP-08.02): JWT required on all non-public routes; Helmet +
`SecurityHeadersInterceptor` apply `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Cache-Control: no-store`. Body size limited via `API_BODY_LIMIT`.

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

## Multi-Day Daily Revalidation (MS-05 / SP-05.02)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/permits/{id}/revalidate` | Required | Complete daily revalidation |
| POST | `/permits/{id}/continue` | Required | Continue after passed revalidation |
| POST | `/permits/{id}/suspend` | Required | Suspend permit (reason required) |
| POST | `/permits/{id}/extensions` | Required | Request permit extension |
| GET | `/permits/{id}/revalidation-history` | Required | Revalidation/continuation history |
| POST | `/extensions/{id}/approve` | Required | Approve extension |
| POST | `/extensions/{id}/reject` | Required | Reject extension |

## Incident Recording (MS-06 / SP-06.01)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/incidents` | Required | Create incident / near miss / unsafe condition |
| GET | `/incidents` | Required | List tenant incidents |
| GET | `/incidents/{id}` | Required | View incident with evidence and links |
| PATCH | `/incidents/{id}` | Required | Update draft incident |
| POST | `/incidents/{id}/submit` | Required | Submit draft → open (notifies Safety Officer) |
| POST | `/incidents/{id}/evidence` | Required | Upload evidence (multipart `file`) |
| GET | `/incidents/{id}/evidence` | Required | List evidence metadata |

## Investigation (MS-06 / SP-06.02)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/incidents/{id}/assign` | Required | Assign investigator |
| POST | `/incidents/{id}/root-cause` | Required | Record root cause analysis |
| POST | `/incidents/{id}/corrective-actions` | Required | Create corrective action |
| POST | `/incidents/{id}/preventive-actions` | Required | Create preventive action |
| GET | `/incidents/{id}/investigation` | Required | View investigation detail |
| PATCH | `/corrective-actions/{id}` | Required | Update corrective action status |

## Incident Closure (MS-06 / SP-06.03)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/incidents/{id}/verify` | Required | Verify investigation complete |
| POST | `/incidents/{id}/close` | Required | Close verified incident + archive |
| GET | `/incidents/archive` | Required | List archived incidents |
| GET | `/incidents/archive/{id}` | Required | View archived incident snapshot |
| GET | `/incidents/{id}/history` | Required | Full investigation/closure history |

## Notifications (MS-07 / SP-07.01)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/notifications` | Required | List current user's notifications (`unreadOnly` query optional) |
| GET | `/notifications/{id}` | Required | View notification (recipient-scoped) |
| PATCH | `/notifications/{id}/read` | Required | Mark notification as read |
| POST | `/notifications/test` | Required | Test delivery (org-admin / platform-admin) |

## Dashboards & Analytics (MS-07 / SP-07.02)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard` | Required | Role-based dashboard (`kind` = personal\|supervisor\|safety\|management) |
| GET | `/dashboard/kpis` | Required | KPI widgets (`kind`, `periodLabel` optional) |
| GET | `/reports` | Required | List report exports for current user (`status` optional) |
| POST | `/reports/generate` | Required | Request report export (`reportType`, `format`, filters/period) |
| GET | `/analytics` | Required | Analytics view (`scope` = permits\|incidents\|lototo\|simops\|operational) |
| GET | `/analytics/trends` | Required | Historical analytics snapshots (`scope`, `limit`) |

## Billing & Subscription (MS-08 / SP-08.01)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/subscriptions/plans` | Required | List active subscription plans |
| GET | `/subscriptions/current` | Required | Current tenant subscription + plan |
| POST | `/subscriptions` | Required | Create tenant subscription (`planId`) — org-admin |
| POST | `/subscriptions/change-plan` | Required | Change plan (`planId`, `reason?`) — org-admin |
| GET | `/subscriptions/plan-changes` | Required | Plan change history for tenant |
| GET | `/billing/invoices` | Required | Billing history (`status` optional) |
| GET | `/billing/usage` | Required | Usage records for tenant |
| POST | `/billing/usage` | Required | Upsert usage metric — org-admin |

