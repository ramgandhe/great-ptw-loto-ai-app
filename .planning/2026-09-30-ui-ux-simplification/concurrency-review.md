# Draft Update Contract and Required Safeguard

## Verified current behavior

`DraftController.updateDraft` exposes `PATCH /permits/:id`; `SaveDraftDto` extends `UpdatePermitDto`. Every content property is optional. `PermitService.update` assigns only defined scalars, so partial top-level updates **are supported**. Omitted collections remain unchanged; supplied hazards, PPE, LOTOTO, gas testing, executors, viewers and safety officers replace their whole collection. Supplied `formResponses` replace the response collection after server resolution.

There is **no expected version, ETag or compare-and-set condition**. `permits` has audit timestamps but no revision. The service loads status and assignment before entering the update transaction. Submission also validates a previously loaded detail before its transaction. A narrow patch reduces unrelated overwrites but cannot prevent stale array replacement, concurrent edits of the same field, or saving after a competing submission.

Sources: `app/src/modules/permit/{draft.controller,draft.service,permit.service,permit-collaboration}.ts`, `dto/update-permit.dto.ts`, `app/src/database/schema/permit.ts`, web `lib/permit/{api,types,form}.ts`.

## Decision: S0a includes a bounded API/schema change

This supersedes “no contract change assumed.” Items 1–4 (without the attachment part of item 4) are **S0a** and land before S2 direct editing, with web and native callers updated together. The attachment/MinIO part of item 4 and all of item 5 are **S0b**, deferred until before S6 closes; until then native queued requests carry their revision and a 409 becomes a visible failed item with local input kept. Rollout: see “Rollout of the revision contract” in the implementation plan.

1. Add integer `draftRevision` to `permits` through a Drizzle migration, backfilled/defaulted to 0. Return it in permit detail. It versions editable permit content and supporting draft evidence, not the entire application.
2. Require `expectedRevision` for draft PATCH and submit. Check tenant, current editable/submittable state and current assignment inside the same database transaction as the write, after locking the tenant-scoped permit row. Reject a missing/invalid precondition with a clear client-upgrade/reload error; reject stale revisions with HTTP 409 and a machine-readable conflict code. No silent legacy bypass.
3. A successful content PATCH increments the revision exactly once, including collection-only/form-only changes, and returns the new detail. Omitted fields remain untouched. Explicit nullable clears must be represented in DTO/client types; an omitted property is not a clear. Collections remain atomic replacements guarded by the revision; do not invent per-item merge behavior.
4. Submit receives the revision returned by the preceding successful save, locks/reloads that same aggregate and validates current data before transition. A competing save causes conflict; duplicate submit cannot initialize approvals twice. Draft deletion and draft attachment metadata changes must participate in the same row-lock/revision discipline. Upload/remove must not alter immutable evidence after a competing transition. Keep MinIO I/O outside long-held database locks, clean up rejected new uploads, and only remove old objects after the authorized metadata transaction succeeds.
5. Update cached details and web/native payloads together. Offline requests retain their base revision. Replay that encounters a conflict stops dependent requests and preserves local input for review. It must not fetch a newer revision and silently retry stale data. Existing queued requests without revision require reconciliation, not a guessed version.

This is intentionally an aggregate conflict boundary: even disjoint simultaneous edits may require review. It is smaller and more predictable than automatic merging. Other lifecycle transitions retain their existing policy; any writer that returns a permit to an editable state must invalidate an old draft revision so an old tab cannot revive earlier content.

## Conflict experience

First version (S2): keep all local values. Show “This permit changed since you opened it. Your changes are still here.” Fetch the latest permitted detail, show the saved value beside each field the actor changed, and let them re-save explicitly against the new revision. Disable submit until that re-save succeeds. Never overwrite a newer answer automatically. Show saving/saved only after server success. A fuller side-by-side **Compare latest** view is deferred until the simple version proves insufficient in use.

## Section-level “All yes” decision

Retain the existing efficiency aid. It is already per section and fills only unanswered check fields. Move it after the questions and label it **Confirm N unanswered checks as Yes**. Open a confirmation listing exactly those questions; final action **I confirm these N checks are Yes** applies only to that section. Existing No/N/A/Yes answers, signatures, measured readings and hidden/unrendered sections are excluded. Showing questions is not evidence they were read; the explicit declaration is the actor's assertion.

Record each persisted answer change with authenticated actor, server timestamp, permit revision, template/section/field IDs and old/new values. Client-provided identity is never authoritative. Batch intent may describe the selected section/field IDs; the server validates them against the applicable template and actual changed answers. Signature controls remain individual.

The current `AuditService.log` can be disabled and swallows database failures. Therefore it cannot be the sole evidence for this promise. Persist answer-change audit rows in the same transaction as the answers, with failure rolling back that answer save; extend existing audit storage rather than creating another event store. Do not rewrite historical evidence. This covers **every** answer change, individual or batch, through one server path; single-answer edits do not keep the best-effort logger as a weaker second route.

## Required tests before S2

- Two saves with the same base revision: one commits, the other conflicts; no mixed/replaced relation rows leak through.
- Different participants editing disjoint fields: second receives conflict with preserved local input; authorized reapply keeps both edits.
- Two actors editing the same check-sheet answer: no silent last-writer overwrite.
- Save versus submit, duplicate submit, attachment versus submit, and stale save after return-to-editable state.
- Revision-only tampering never bypasses tenant/RBAC/assignment checks; all writes use the tenant-scoped locked row.
- Conflict/network/validation errors retain inputs; missing revision cannot silently downgrade protection.
- Offline replay sends original revisions; a 409 leaves a visible failed item with input kept (S0a). Stopping dependent transitions and legacy reconciliation are S0b tests.
- Conflict screen: after 409, local values stay, saved values show beside changed fields, re-save against the new revision succeeds, and submit stays disabled until it does.
- A single-answer edit writes its audit row in the same transaction; forced audit failure rolls it back.
- Batch confirmation touches only displayed unanswered checks; cancel changes nothing; existing No/N/A and signatures remain unchanged; audit failure rolls back the answer save.

These are implementation requirements, not tests already passed.
