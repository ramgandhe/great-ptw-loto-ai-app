# Proposed corrections for the follow-up review (PRD v0.2 → v0.3)

Source findings: `follow-up-review.md` (9 findings). Each was verified against the v0.2 text and is valid. Below, FX-n is the proposed fix; text in quotes is the exact replacement or addition.

## FX-1 (SPEC-01) Closure fails rule check 11; Execution has two roles in one part
- Glossary "Step": "One unit of a workflow (for example "Approval"), of a fixed step type, with one to three ordered parts."
- FR-WFD-003, replace the second and third sentences with: "Step types with more than one part have a role for each part; parts run in the order listed, and the step is done when every part that applies is done. Execution has no parts: actions inside it are checked per action against permissions (FR-CRW-005, FR-PTW-009)."
- §8.2 table, Execution default roles: "No parts: checked-in crew record progress; holders of 'resume' resume after stop work". Closure default roles: "Part 1 Receiver reports completion and restores; part 2 Safety officer verifies restoration (only when the permit was the last holder of an isolation point, FR-LTO-103); part 3 Coordinator inspects the area and accepts closure".
- §5.4 table gains a "Part 3 needs" column. Execution row: "— (no parts; record progress and resume are checked per action)". Closure row: part 1 "report completion, restore isolation"; part 2 "verify restoration"; part 3 "accept closure".
- Result: the unmodified default passes check 11 (Receiver holds part 1, Safety officer part 2, Coordinator part 3).

## FX-2 (SPEC-02) Shared isolation deadlock
- Replace FR-LTO-103 with: "An isolation point can be held by more than one open permit; each permit's reliance on it is a hold. A permit releases its hold when its work on the point is done: the receiver requests the release, and a holder of 'verify isolation' confirms the point stays isolated for the remaining holders. A point can be physically restored only when no other permit holds it and no personal lock (FR-LTO-104) is on it; the restoration screen lists any remaining holders and locks. The last permit holding a point restores it, and the restoration is verified."
- FR-PTW-010: replace "Isolation is restored and the restoration verified where it was applied." with "Every isolation hold of the permit is released under FR-LTO-103: restored and verified where the permit was the last holder, otherwise released with the remaining holders confirmed." Replace "Closure is refused while any crew member is checked in or any isolation under the permit is not restored." with "Closure is refused while any crew member is checked in or the permit still holds any isolation point."
- FR-PTW-011 (b): replace with "(b) every isolation hold of the permit is released under FR-LTO-103, or, where no other permit holds the point, the hold is transferred to another open permit that takes it over, with the transfer verified by the safety officer."
- §21 criterion 8: append "; with two permits holding one point, the first closes by releasing its hold, and the point is restored only by the second."

## FX-3 (SPEC-03) First-day revalidation cycle
- Replace FR-CRW-006 with: "On the first day, the checks completed before Issue (safety check, gas test under FR-GAS-002, isolation verified, SIMOPS at Issue) count as that day's revalidation, and check-in follows Issue. From the second day of a multi-day permit, the receiver and safety officer first complete the daily revalidation (conditions, isolations intact, gas test under FR-GAS-002, SIMOPS re-evaluated); only then can the receiver check crew in. Each day's crew list and check-in record are attached to that day's revalidation record (on day one, the Issue record)."
- Replace FR-MDP-101 with: "From the second day, each day starts with the daily revalidation, then check-in (FR-CRW-006)."

## FX-4 (SPEC-04) Status lists omit Expired, Execution completed, Pending closure
- Glossary, new row: "Open close-out | A permit that has reached Isolation or Issue and whose making safe is not finished: status Issued, Active, Suspended, Expired, Execution completed or Pending closure, or any status while a make-safe task is open or the permit holds an isolation point."
- FR-AGY-008, second bullet: replace "On its permits that are Issued, Active or Suspended" with "On its permits with open close-out".
- FR-ONB-013, second bullet: replace "On permits already Issued, Active or Suspended" with "On permits with open close-out"; fourth bullet: replace "while any permit is Issued, Active or Suspended or any isolation is applied" with "while any permit has open close-out or any isolation is applied".
- FR-PTW-013: replace "on a permit that is Issued, Active or Suspended" with "on a permit with open close-out".
- §21, new criterion 10: "An expired permit with checked-in crew and no isolation keeps every close-out action available to its receiver after its engagement ends and after the trial clock passes the read-only date, and the organisation is not suspended until it is closed."

## FX-5 (SPEC-05) End now gives the coordinator receiver duties barred by FR-ROL-005(c)
- FR-AGY-008, End now bullet, replace with: "The client may instead choose **End now** (for example for misconduct or a compromised agency account): agency access ends at once and those permits are suspended. The coordinator assigns the receiver duty to an eligible internal receiver at the plant (FR-PTW-013; no acceptance by the outgoing agency receiver is needed). Until one accepts, the make-safe task escalates under the Issue step's escalation, and a legal-entity admin can give the Receiver role to an internal person (FR-ROL-008). The internal receiver completes the receiver part of making safe (FR-PTW-011), including recording where each agency crew member is; restoration verification and closure acceptance stay with their own roles."
- FR-PTW-011 (a): replace "or the receiver (or, after End now, the coordinator) records where each one is" with "or the receiver records where each one is".
- FR-PTW-013: append "After End now, or when the outgoing holder has lost access, the outgoing acceptance is not needed."
- review-log C2 minority note: updated to this path.

## FX-6 (STD-01) Engagement end removes promised emergency access
- FR-AGY-006: replace "While an engagement is active, the client sees" with "While an engagement is active (and, for the emergency subset only, also while a permit has open close-out or within 72 hours of an incident on it, FR-PRV-006), the client sees".
- NFR-SEC-002 (b): append "This emergency-subset path also serves, whatever the engagement's state, permits with open close-out and the 72 hours after an incident on the permit, for the FR-PRV-006 recipients only. It never reopens other agency staff fields or any agency user's access."
- §21 criterion 5: append "; ending the engagement during an incident response leaves the emergency subset available to those recipients for the 72 hours, and nothing else of the agency's records."

## FX-7 (STD-02) Offline health copies outlive the 24-hour withdrawal deadline
- FR-PRV-006, replace the offline sentence with: "Offline, it may be cached for checked-in crew of permits where the user holds a role, only in the encrypted store. Consent-based fields (blood group, health conditions) in that copy expire 24 hours after the device's last sync and are then deleted from the device, and every sync applies withdrawals at once; emergency contacts, which do not depend on consent, stay until the permit closes. Offline views are logged at sync."
- §18 Mobile: replace "Crew copies (FR-CRW-002), the headcount (FR-CRW-007) and the emergency subset (FR-PRV-006) are the only personal data cached, all wiped when the permit closes." with "Crew copies (FR-CRW-002), the headcount (FR-CRW-007) and the emergency subset (FR-PRV-006) are the only personal data cached, all wiped when the permit closes; consent-based fields also expire 24 hours after the last sync (FR-PRV-006)."
- §21 criterion 5: append "; a device kept offline for more than 24 hours after a withdrawal shows no blood group or health conditions but still shows emergency contacts."

## FX-8 (SPEC-06) Offline replay contradicts across FR-ONB-018 and §18
Chosen behaviour: replay is not delayed by the displayed tenant, because stop-work and check-out events must not wait.
- FR-ONB-018: replace the last sentence with "Each queued offline action keeps the tenant it was made in and syncs to that tenant, over a session for that tenant, whichever tenant is displayed."
- §18 Mobile: replace "queued actions are kept and sent only while their own tenant is active" with "queued actions are kept and sent in the background whichever tenant is displayed, each over its own tenant session (a separate token for that tenant, NFR-SEC-006)". Keep: "the server refuses one whose tenant does not match the session".

## FX-9 (SPEC-07) Phase exits depend on later phases
- Phase 2 content: append "; rule checker core (role checks and check 3) with the platform default workflow loaded as data, so plants can go Live". Phase 3 content: replace "Engine, designer, rule checks, default workflow" with "Engine, designer, the remaining rule checks".
- Phase 4 content: append "; daily revalidation from day two (FR-CRW-006, FR-MDP-101)". Phase 5 content: replace "multi-day revalidation" with "multi-day extension and renewal [v1 FR-MDP-009]".
- Note under the table: "Each phase's exit is walked using only that phase and earlier ones, with no database edits and no skipped checks."
