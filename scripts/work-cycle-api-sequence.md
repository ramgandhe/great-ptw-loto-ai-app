# Work cycle API sequence (J1 / J2)

Run against a local API with an authenticated executor token and an **active** permit that already passed Start.

Replace `BASE`, `TOKEN`, `PERMIT_ID`.

## Multi-period loop (J1)

```bash
# Progress (in_progress only)
curl -sS -X POST "$BASE/permits/$PERMIT_ID/progress" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"summary":"Work progressing"}'

# Pause → paused
curl -sS -X POST "$BASE/permits/$PERMIT_ID/work/pause" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "summary":"End of period leave-safe",
    "checklist":{
      "personnelCleared":true,
      "workAreaLeftSafe":true,
      "materialsToolsSecured":true,
      "isolationsIntact":true,
      "openingsBarricaded":true,
      "emergencyAccessClear":true,
      "overnightHazardsNoted":true
    }
  }'

# Progress while paused must fail
curl -sS -o /tmp/progress-paused.json -w "%{http_code}" -X POST "$BASE/permits/$PERMIT_ID/progress" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"summary":"should fail"}'
# expect 409

# Resume → in_progress
curl -sS -X POST "$BASE/permits/$PERMIT_ID/work/resume" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"checklist":{"safeToContinue":true,"lototoIntegrityConfirmed":true,"workAreaInspected":true,"barriersSignageIntact":true,"emergencyRoutesClear":true,"personnelAccounted":true,"overnightChangesReviewed":true}}'

# Pause again, resume again (loop)
# …repeat pause/resume…

# Complete (in_progress only)
curl -sS -X POST "$BASE/permits/$PERMIT_ID/complete-execution" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"comment":"Job finished","checklist":{"workDescribedComplete":true,"procedureFollowed":true,"lototoDone":true,"gasTestingDone":true}}'

# Then existing: verify → LOTOTO restore → request close → approver close
```

## Single-day (J2)

Same pause/resume/complete path — no multi-day gate. Use a single-day permit; Pause is still available.

## UI acceptance (J3)

- Never show Pause and Resume forms together.
- Complete control only when work UI state is `in_progress`.
- Confirm dialog “ends the job” before Complete submit (web + mobile).
