# API reference

Base path: `/api/v1`

## Platform

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | Public | Aggregated dependency health |
| GET | `/health/live` | Public | Liveness probe (process up) |
| GET | `/health/ready` | Public | Readiness probe (DB+Redis); `503` when not ready |
| GET | `/system/config` | Public | Client config |
| GET | `/system/version` | Public | Version |

Security notes (SP-08.02): JWT required on all non-public routes; Helmet +
`SecurityHeadersInterceptor` apply `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Cache-Control: no-store`. Body size limited via `API_BODY_LIMIT`.

Production boot guards (SP-08.03): `NODE_ENV=production` requires
`REDIS_PASSWORD` + `CORS_ORIGIN` and rejects known local/dev secret defaults.

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
| POST | `/notifications/test` | Required | Test delivery (tenant-owner / platform-admin) |

## Dashboards & Analytics (MS-07 / SP-07.02)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard` | Required | Role-based dashboard (`kind` = personal\|hod\|safety\|management) |
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
| POST | `/subscriptions` | Required | Create tenant subscription (`planId`) — tenant-owner |
| POST | `/subscriptions/change-plan` | Required | Change plan (`planId`, `reason?`) — tenant-owner |
| GET | `/subscriptions/plan-changes` | Required | Plan change history for tenant |
| GET | `/billing/invoices` | Required | Billing history (`status` optional) |
| GET | `/billing/usage` | Required | Usage records for tenant |
| POST | `/billing/usage` | Required | Upsert usage metric — tenant-owner |

## Sites, work locations and assets (refined 14 October 2026)

Auth: tenant admin (or owner) for configuration. Permit routes stay on `/permits`. Membership limits every list below to the caller's sites; owner and admin are unscoped.

| Method | Path | Notes |
| --- | --- | --- |
| GET, POST | `/sites` | List, create. Body: `code`, `name`, `description?`, `address?` |
| GET, PATCH | `/sites/{id}` | Read, update |
| POST | `/sites/{id}/archive` | Refused while an active permit uses the site |
| GET, POST | `/sites/{id}/members` | People tab. POST body: `userId` |
| DELETE | `/sites/{id}/members/{userId}` | Also drops that user's approver rows on the site. `409` with a warning when a location would be left with no approver; repeat with `confirm=true` to proceed |
| GET, POST | `/location-types` | Admin list. Seeded; "Site" is rejected as a name |
| PATCH | `/location-types/{id}` | Rename or archive |
| GET, POST | `/work-locations` | `siteId` query required on GET. POST body includes optional `parentId`, `locationTypeId` |
| GET, PATCH | `/work-locations/{id}` | Parent change rejected on a cycle or a cross-site parent (`422`) |
| POST | `/work-locations/{id}/archive` | Refused while an active permit uses it or a descendant |
| GET, PUT | `/work-locations/{id}/approvers` | PUT replaces the location's own list. Empty list means "inherit" |
| GET | `/work-locations/{id}/approvers/resolved` | Effective approvers after inheritance, plus `inheritedFrom` |
| GET, POST | `/asset-types` | Admin list, seeded |
| PATCH | `/asset-types/{id}` | Rename or archive |
| GET, POST | `/assets` | Filter `siteId`, `workLocationId` (includes descendants unless `exact=true`) |
| GET, PATCH | `/assets/{id}` | Tag unique per site; asset number unique per tenant when set |
| POST | `/assets/{id}/archive` | Refused while an active permit uses it |
| GET, POST | `/gas-testing` | Body target is `workLocationId` or `assetId`, not both. A child location cannot store a wider limit than it inherits (`422`) |
| GET | `/gas-testing/defaults` | Query `workLocationId` and repeated `assetId`. Returns merged rows, strictest limit, and `source` |
| POST | `/imports` | Accepts sites, work locations and assets in addition to existing catalogues |

Permit create and update accept `siteId`, `workLocationId`, `exactSpot` and `assetIds`. Gas test rows on the permit accept `removedReason`, a tightened `minimum`/`maximum`, and hand-added rows. Loosening a configured limit returns `422`. LOTOTO required with an empty `assetIds` returns `422`.

`/plants`, `/locations`, `/workstations` and `/machinery` stay readable. Their web screens are read-only. Departments stay editable because they group people for reporting only. New places and equipment are written on the routes above. Refined 14 October 2026. LOTOTO procedures and plans take `assetId` instead of a machinery id. Incidents require `siteId` and `workLocationId`; `assetIds` is optional. Dashboard and list filters accept `siteId` and `workLocationId` (descendants included).

