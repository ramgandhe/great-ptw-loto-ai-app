# Later cleanup backlog (J5) — not this cycle

After the locked Work path soaks in production/demo:

1. Confirm no operator UI still requires daily-progress submit before Pause.
2. Confirm morning day-secure / reopen are only secondary or fully superseded by Pause/Resume.
3. Drop or archive unused MDP endpoints/UI that duplicate Progress/Pause/Resume.
4. Drop unused tables/columns only after zero live writers and a data migration plan.
5. Regression: create → approve → release → start → pause ⇄ resume → complete → verify → restore → close.

Do **not** execute hard deletes in the Work refinement cycle.
