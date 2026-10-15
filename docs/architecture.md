# Architecture

PTW platform layout maps the production stack onto NestJS + Next.js.

```
app/                 NestJS API (PTW modules)
frontend/            Next.js web UI
mobile/              React Native (Expo)
packages/shared/     Shared types/constants
tests/               Jest suites
scripts/             seed, migrate, healthcheck wrappers
infrastructure/      Keycloak realm export
docs/                Specs + architecture
```

Frontend calls `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`).

## Place model (refined 14 October 2026)

Replaces Plant → Department → Location → Workstation → Machinery. See PRD section 5.12.

```
Site
 └── Work location (parent_id, any depth, same site, no cycles)
       ├── approvers (own list, or inherited from the nearest ancestor)
       ├── gas test limits (own rows, plus inherited; a child may only tighten)
       └── Asset (tag unique per site; optional parent asset, same site)
             ├── LOTOTO procedure and energy sources
             └── gas test limits (added on top of the location's tests)
```

**Site scope.** Queries for places, assets and permits are limited to sites the user belongs to. Tenant owner and tenant admin are unscoped. Contractors are users and follow the same membership.

**Approvers.** Walk from the permit's work location to the site root. The first location with its own approver list wins. Notify all of them; any one may approve. If the walk finds none, any tenant permit-approver may approve and the location is flagged in setup. The operator of a permit cannot approve it.

**Gas test defaults.** Collect location rows from the chosen location up to the root, then the rows of each selected asset. For one parameter, keep the strictest bound (highest minimum, lowest maximum). Each permit row stores its source (`work_location` or `asset`, plus the id). A permit may drop a default only with a reason, add a row, or tighten a bound. It cannot widen a bound. Recalculation keeps hand-added rows.

**SIMOPS.** Overlapping permits: same `asset_id`, or the same `work_location_id`, is a conflict. One location being an ancestor of the other is a warning. Other pairs in the site are not a place conflict.

**History.** Permits store `site_id`, `work_location_id` and the path text captured at issue, so a later rename or move does not rewrite issued permits. Archive refuses a site, location or asset that an active permit still references. Deletes do not cascade to permits.

**Migration.** `plants` → `sites`. `departments`, `locations` and `workstation_catalogue` → `work_locations`, parent links preserved. `machinery_catalogue` → `assets`. LOTOTO procedure and energy-source foreign keys move to `assets`. Existing users are inserted into `site_members` for every site of their tenant. Old tables remain until the migration check passes.
