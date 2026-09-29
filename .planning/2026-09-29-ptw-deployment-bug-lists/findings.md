# Findings
- dev_vinesh ⊂ dev_ram (merge-base check). 7 extra commits on dev_ram.
- xlsx col I "Open Issues" is a free list NOT aligned with its row's PTW id.
- Duplicates inside xlsx Open Issues: phone 10 digits (OI-15, OI-46), certificate view (OI-17, OI-54), HOD notif (OI-32, OI-64), cert expiry chars (OI-05, OI-56), billing qty (OI-25, OI-49), billing duplicate metrics (OI-26, OI-50), usage w/o plan (OI-27, OI-51), profile picture (OI-47/48 ~ D3-10), sign-in back (OI-57, OI-59).
- Cross-source dupes: LOTO evidence (D3-02, OI-11), machinery refresh (D3-04, OI-63), incident UUID expired (D3-05, OI-30), HOD notif (D3-12, OI-32, OI-64), evidence view (D3-11, OI-08), temp password copy (D3-13, OI-39/40), root cause (D3-15, OI-33), corrective action (D3-16, OI-34).

## Triage notes
- Multipart uploads (lib/execution/api.ts uploadEvidence, incidents uploadIncidentEvidence, permit uploadPermitAttachment, auth/api.ts avatar) bypass fetchApi → no 401 token refresh → "Authentication required" once the 5-min Keycloak token expires (D3-09). Fix: shared upload helper in lib/api.ts with refresh.
- fetchApi does `await response.json()` unguarded → a 502/empty body throws a TypeError → forms show "couldn't reach the server".
- "Validation failed, UUID expired" = Nest ParseUUIDPipe "Validation failed (uuid is expected)" from GET /incidents/undefined. Root cause fixed in 2c2473f (createIncident unwrapped IncidentDetail). D3-05/OI-30.
- Request Access (D3-01): on dev server via http://200.234.45.51 preflight+POST work (400 validation on {}). HTTPS :443 closed; CORS_ORIGIN + NEXT_PUBLIC_API_URL pinned to the IP → opening via any hostname fails every API call with "couldn't reach the server". Config recommendation.

## Found during verification
- Keycloak 26 user profile drops undeclared attributes: users created by the app (Users & Roles, workforce logins, tenant invites) had NO tenant_id → role change 403 "User is not in this tenant", and their tokens carry no tenant. Fix: KeycloakAdminService.allowTenantAttribute (unmanagedAttributePolicy ADMIN_EDIT, once per process) + ensureTenantAttribute; TenantUsersService.onApplicationBootstrap repairs existing logins. Verified: 2 broken users repaired, names intact.
- Seeded demo users live only in Keycloak (tenant_users has only operators) → next-approver lookup must use Keycloak roles (listUsersForTenant), tenant_users only for department.
- `.table-head` (sticky) inside overflow-x-auto boxes covered the first row (workforce, org entities, checklists, and Reports — already deployed in 2c2473f). Added `.table-tone` (look only) for those tables.

## New issues report (2026-09-29 afternoon) — NI-01..NI-10 (all "New – Current Testing")
1 Sign In/PKCE P1: valid creds → "Sign in failed, missing PKCE verifier, sign in again"; must go Back before retry.
2 Notifications P1: opening a notification doesn't mark it read.
3 Workstation/Machinery P1: wizard continues/submits without required workstation+machinery.
4 Permit Closure/Org Admin P1: org admin can close permit though UI says HOD closes.
5 Lifecycle History P2: completed steps not visually distinct.
6 Resubmission/Notifications P1: job issuer resubmits → no notification to org admin.
7 Permit Templates Import Reference P1: not working.
8 Permit creation Gas Testing P1: Gas Testing Required toggle not working.
9 Permit creation LOTO P1: Add Lockout/Tagout field not working.
10 User & Roles Department P2: department dropdown purpose unclear.
