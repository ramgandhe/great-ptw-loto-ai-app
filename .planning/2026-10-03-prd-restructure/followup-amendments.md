# Round 4 (final): consolidated amendments to FX-1..FX-9

All nine FX passed round 3 with 3 of 3 (agree or agree-with-amendment). The amendments below came from votes-followup-1/2/3.md. Proposer(s) in brackets. Items with two or more proposers already pass; vote on all items anyway (your own count as agree). For A3 and A12, choose option a or b.

This is the final round. Do not propose new findings. Flag only a direct contradiction between two amendments, or between an amendment and an FX, in one line.

## FX-1 Steps and parts
- A1 [R2] Glossary "Step": "…with up to three ordered parts (Execution has none)."
- A2 [R3] FR-WFD-003: after "parts run in the order listed" add ", except the two Check sheets parts, which can be filled in either order".
- A3 Daily revalidation order (conflict: v0.2 part 1 holds check-in, before the safety officer's part):
  - A3a [R1] Two parts: part 1 Receiver "revalidate day"; part 2 Safety officer "safety check". Check-in follows the step under FR-CRW-006, checked per action.
  - A3b [R3] Three parts: part 1 Receiver "revalidate day"; part 2 Safety officer "safety check"; part 3 Receiver "check crew in/out" (mirrors Issue part 2).
- A4 [R1, R2, R3] Closure part 2 needs "verify restoration, verify isolation" and applies whenever the permit held an isolation point: the safety officer verifies the restoration (last holder) or confirms the release (otherwise). The receiver's release request needs "restore isolation".
- A5 [R1] Closure part 1: "Restoration is refused until the receiver has confirmed every crew member is out and checked out, guards and barriers are back, and tools and materials are removed."
- A6 [R1, R2] §9.1 check 3, append: "Execution has no parts; at every Live plant at least one internal (non-agency) account holds 'resume', and at least one person holds 'record progress'."

## FX-2 Isolation holds
- A7 [R2] FR-LTO-103: "Physically restoring a point needs a live server check that no other hold or personal lock exists. Offline, the app shows 'Connect to confirm no other holder before restoring' and records no restoration."
- A8 [R2] FR-ROL-005(e): append ", or request the release of a hold and confirm the same release (FR-LTO-103)".
- A9 [R1] FR-LTO-103: "A permit takes a hold on a point that is already isolated in its own Isolation step. The performer records the hold (and the permit's personal locks, FR-LTO-104), and a holder of 'verify isolation' verifies the point (try-out) for that permit. The High clash of v1 FR-SIM-021 must be resolved first."

## FX-3 Days and revalidation
- A10 [R2, R3] FR-CRW-006 and FR-MDP-101: "first day" becomes "the date of Issue (plant time zone)"; "from the second day" becomes "on every later date of a multi-day permit". A day is the calendar date in the plant's time zone.
- A11 [R1] FR-CRW-006: "If no crew member is checked in by the end of the date of Issue, the issue lapses. The coordinator issues the permit again, after FR-GAS-002 is met and a holder of 'verify isolation' confirms the isolations are intact. Checks made before Issue never count for a later date."
- A31 [R1] NFR-OFF-001: add "daily revalidation (both parts)" to the offline actions. FR-CRW-002 offline bullet: "and refuses check-in unless the device holds that day's completed revalidation and, where gas testing applies, an in-limit reading within its validity (FR-GAS-002)".

## FX-4 Open close-out
- A12 Agency permit isolated but not yet issued when the engagement ends:
  - A12a [R1] FR-AGY-008 first bullet: "A permit not yet issued returns to Raise even if it holds isolation points. Its holds stay with the permit and are re-verified in its Isolation step for the new crew lead (FR-WFE-006), or released or restored under FR-PTW-011 if it is cancelled." Second bullet: "On its permits that have reached Issue and have open close-out".
  - A12b [R3] FR-AGY-008 first bullet: "its permits not yet issued return to Raise for a new crew lead once they have no open close-out; until then they follow the wind-down below".
- A13 [R1] FR-ONB-013 second bullet: add "daily revalidation, handover" to the actions that keep working.

## FX-5 End now
- A14 [R2] "an eligible internal receiver at the plant (one who holds the Receiver role there and is not barred by FR-ROL-005 or FR-ROL-009)".
- A15 [R2] "Actions the agency's devices queued for those permits are refused at sync and kept, unapplied, in a 'Received after End now' list on the permit for the coordinator and safety officer to review; none is applied automatically."
- A16 [R3] Replace "Until one accepts, the make-safe task escalates under the Issue step's escalation" with "Until one accepts, the receiver part of the make-safe task is offered to every internal Receiver holder at the plant as a pooled item (FR-WFE-002) and, after the Issue step's target, is flagged to the legal-entity admins".
- A17 [R1] "The internal receiver records each agency crew member's check-out and lock-off as witness, in the same way as for crew-only people (FR-CRW-012). A lock whose owner is not present is removed only under FR-LTO-104."
- A18 [R1] NFR-SEC-002, add path "(c) A client receiver's check-out of an agency worker writes only the check-out time to that worker's agency attendance record, through one SECURITY DEFINER function, and is logged in both tenants." ("exactly two paths" becomes "exactly three paths".)

## FX-6 Emergency access
- A19 [R2] FR-AGY-006 and NFR-SEC-002(b): "the photo and emergency subset only" / "This photo and emergency-subset path"; append "The function itself checks these conditions in the database."
- A20 [R2] FR-PRV-006: "until the permit is Closed, Rejected or Cancelled" becomes "while the permit has open close-out"; the incident clause becomes "for 72 hours after an incident on that permit is reported, if it was reported while the permit had open close-out or within 24 hours of the permit closing, and then only for crew checked in on the day of the incident".

## FX-7 Offline expiry
- A21 [R1, R2] "expire 24 hours after the device's last sync, measured as time elapsed since that sync on the device's monotonic clock, not by the wall clock (and are deleted at once if the device restarts while offline)".
- A22 [R2] "emergency contacts … stay until the permit closes or the 7-day offline wipe (§18), whichever comes first".

## FX-8 Background replay
- A23 [R2, R3] NFR-SEC-006 and §18: "The mobile app may hold one server session per tenant at once, each validated against the account's person records; a background session only sends queued actions and reads their results, and caches nothing. Each queued action is sent only with its own tenant's session."
- A24 [R2] FR-ONB-018 and §18: "Queued actions are sent only under the account that recorded them; the server refuses one whose account or tenant does not match the session. Signing out with unsynced actions shows a warning that lists them, and they wait on the device for that account's next sign-in."
- A25 [R3] §22 R2 spike list: add "two tenant sessions held at once on mobile".
- A26 [R1] FR-ONB-018: "An unsent stop work, check-out or lock-off for another tenant shows a persistent banner naming that tenant until it is sent. If that tenant's session cannot be refreshed, the banner asks the person to sign in to send it."

## FX-9 Phases
- A27 [R3] FR-WFD-001: "A new legal entity's first workflow version is a copy of the organisation standard and is active from creation; its plants still go Live only through rule check 3 (FR-PLC-006)."
- A28 [R3] Pilot note: "Pilot permits end on the day they start (multi-day from Phase 4), and check-in, check-out and stop work need a connection (offline from Phase 4)."
- A29 [R3] Phase 3 content: add "certificate, competency and induction blocks for internal crews and role holders (FR-CRW-003, FR-ROL-009, FR-CRW-011); emergency subset on the permit, online (FR-PRV-006)". Phase 4: replace "inductions, certificate blocks" with "agency insurance blocks, offline emergency-subset cache".
- A30 [R3] Phase 6 content: add "trial read-only and suspension (FR-ONB-013)".

Write votes-final-<n>.md in this directory:
```
A1: agree | ...
A3: a | <why>
A12: b | <why>
...
Contradictions: none | <one line each>
```
