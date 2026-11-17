# Locked Work flow contract

**Status:** authoritative for this cycle  
**Scope:** Start → Progress → Pause ⇄ Resume → Complete → verify → LOTOTO restore → close  
**Deferred:** Hard drops of unused MDP tables/endpoints (next cycle)

## Operator loop

```
Start (full) → in_progress
  ⇄ Pause (leave-safe) / Resume (policy-based)
  → Complete (full checklist)
  → Receiver verify → LOTOTO restore (module) → request close → Approver close
```

Suspension (`POST …/suspend` / `POST …/resume`) is separate from work Pause/Resume.

## States

| Operator UI state | Source |
|---|---|
| `not_started` | No execution / permit still `approved` |
| `in_progress` | Execution exists, `work_state = in_progress`, not suspended |
| `paused` | `work_state = paused` |
| `completed` | Permit `execution_completed` / `pending_closure` / `closed` |
| `suspended` | Permit suspended (overrides pause for UI) |

**DB:** `permit_execution.work_state` is only `in_progress` | `paused`. Other UI states are derived (B1).

## UI matrix (XOR)

| State | Start | Progress/Evidence | Pause | Resume | Complete | Handover |
|---|---|---|---|---|---|---|
| not_started | Yes | — | — | — | — | Yes |
| in_progress | — | Yes | Yes | — | Yes | Yes |
| paused | — | — | — | Yes | — | Yes |
| completed | — | — | — | — | — | — |

Complete is never allowed from `paused` (must Resume first).

## APIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/permits/:id/work` | Work cycle snapshot + templates |
| POST | `/permits/:id/work/pause` | Pause (summary + leave-safe + LOTOTO overnight) |
| POST | `/permits/:id/work/resume` | Resume (audit ON composition / minimal OFF) |
| POST | `/permits/:id/complete-execution` | Complete (in progress only) |
| POST | `/permits/:id/progress` | Progress log (in progress only) |
| POST | `/permits/:id/resume` | **Suspension** resume only |

### Pause payload

- `summary` (required)
- `checklist` — leave-safe (day-secure keys: personnel cleared, area safe, tools secured; full mode adds isolation/barricade/emergency/hazards)
- `lototoRemovals[]` — point/lock ids removed overnight
- `overnightRestoreChosen` — only if org `overnightIsolationPolicy = restore_allowed`

### Resume payload

- `checklist` — keys from resume template (audit ON fuller / OFF minimal + LOTOTO integrity or reisolate ack)
- `notes` optional
- Audit-ON also gates SIMOPS / PPE reconfirm / gas ack via reopen composition
- Toolbox talk on Work Resume is a required checkbox (`toolboxTalkConfirmed`), same as the other resume ticks
- Daily crew roster stays on Start / day reopen

## LOTOTO overnight

| Org policy | On Pause | On Resume |
|---|---|---|
| `hold` (default) | Isolations stay on; cannot choose overnight restore | Integrity confirm if `lototoRequired`; full re-LOTOTO if removals or live not isolated |
| `restore_allowed` | Optional overnight restore → `reisolateRequiredOnResume` | Full LOTOTO (same as Start) before resume |

Rules:

- Overnight list = open crew locks + linked isolation certificate points
- Any marked removal → full re-isolation before Resume
- Live LOTOTO state overrides false “all intact”
- No partial isolation management beyond removals at Pause

## History event map (B9)

| Locked name | Stored action |
|---|---|
| work_started | `activated` |
| work_paused | `work_paused` |
| work_resumed | `work_resumed` |
| work_completed | `execution_completed` |

## Close path (unchanged)

1. Complete → `execution_completed`  
2. Receiver verifies  
3. LOTOTO restore in module (if required)  
4. Request close  
5. Approver closes  

## Implementation rules

1. One operator Work path (web + mobile).  
2. No new unused flags.  
3. Wrap old MDP storage behind Pause/Resume names; do not expose two progress concepts.  
4. Create / approve / release / LOTOTO module / close unchanged unless a gate needs work state.  
5. Hard schema cleanup → next cycle.  
6. OpenQodex before push.
