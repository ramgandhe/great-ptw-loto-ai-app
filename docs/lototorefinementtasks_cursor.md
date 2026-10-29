# LOTOTO refinement — reviewed plan

This file is the reviewed working plan for the next LOTOTO cycle. It records the expert review of the current module, the review of tasks 01–15, and the tasks to implement. `docs/lototorefinementtasks.md` is the original task list and is left unchanged.

Nothing in this file is an instruction to change the permit lifecycle. LOTOTO changes belong in the LOTOTO module.

## Locked permit rule

On a permit, the operator still proves the isolation before work starts, and still proves the restoration after the work is finished.

- Apply steps, in order, then a listed verifier records Pass. Work cannot start before that Pass.
- Remove steps, in order, then a listed verifier records Pass. The receiver is not asked to close the permit before that Pass.
- The six start checks stay as they are. Receiver release stays as it is. Completion, send-back, and closure stay as they are.
- A permit with LOTOTO turned off never enters this path.
- No new permit status for isolation, sanction for test, or long-term isolation.

A certificate may hold the shared isolation record for one asset or one work location. The permit screen still shows the same two phases. If several permits share one isolation, the first job walks the apply steps. A later permit sees those steps already passed and, when a lockbox is in use, adds only its own personal lock. Restoration uses the same remove steps and stays blocked until every permit on that isolation has finished work.

The live site already follows the single-permit version of this rule. The local certificate code does not. If a permit is attached to a certificate, start of work checks the certificate status instead of the ticked steps, and closing the permit skips the restoration check. That bypass is a defect. Fix it under task 02 before any certificate is used on a permit.

## What is live today

The procedure library is the LOTOTO module operators use.

- A procedure belongs to one asset or one work location.
- A published version freezes onto the permit. A later edit of the template does not rewrite an active job.
- Each point has a code, energy type, magnitude, place, action, device, and how to prove it dead.
- Energy types already include electrical, mechanical, hydraulic, pneumatic, chemical, thermal, pressure, gravity, gravitational, radiation, stored energy, and other.
- Apply and remove are separate sequences. The permit screen ticks those steps. Pass and Fail are separate runs, with a signed name and an optional photo.
- Extra points and a reasoned “not applicable” exist. Crew and verifiers are named.
- Work cannot start until the apply run has passed. The receiver cannot close until the remove run has passed.
- `/lototo` is the procedure library. There is no certificate screen.

An older plan, point, and execution set is still reachable from LOTOTO pages. The close rule uses the sequence Pass, not those older point rows. Sequence lines and point rows can drift apart. One execution record is required: ticking a step records that point.

## Review of the original tasks

Tasks 01–05 are API code on this machine only. Task 06 is a table definition only. None of it is deployed. https://permitwiseai.cloud remains on `dev_ram_vinesh` at `9f11560`, whose last LOTOTO migration is `0085`.

| Task | What is in the repo | What is wrong or missing |
|---|---|---|
| 01 Certificate | `isolation_certificates`, create, list, update, status change, audit | Creating a certificate stores a procedure id and does not copy points or sequences. Status can become `isolated_verified` with no try-out. |
| 02 Several permits | Attach, detach, start gate, restoration refused while a permit is approved, active, or suspended | Attaching a certificate makes permit close skip restoration. That breaks the locked permit rule. |
| 03 Try-out | `zero_energy_verifications` with category, instrument, readings, photo key. An expired calibration date is rejected. | Not required before the certificate can be called verified. Live-Dead-Live is a bag of numbers, not the three-step prove. |
| 04 Lockbox | Box, seal, personal locks, block on releasing keys while a personal lock remains | No screen. A one-person lock on the device itself is not modelled. The lockbox is treated as the only pattern. |
| 05 Blinds | Blind rows, install, remove, block on restoration while a blind is still installed | A blind is not tied to an isolation point. No screen. |
| 06 Sanction for test | `isolation-sanction-test.ts` only | No migration, no service, no screen. The original text sets permit status to suspended from the isolation service. Do not do that. |
| 07–10 | Not started | See the corrected tasks. Role titles such as “HSE Director” do not match this app. |
| 11–15 | Not started | No certificate UI, no mobile change, no printed tag. Tasks 04 and 05 claim UI and have none. |

SQL files `0089_isolation_certificates.sql` through `0093_isolation_blinds.sql` exist. The migration journal stops at `0088_permit_custom_hazards`. A normal migrate will not apply `0089`–`0093`. Register those files in the journal, in order, before adding more tables. Do not reseed. Do not deploy this cycle unless asked.

People in this app are tenant users identified by Keycloak. There is no `workforce_users` table. New foreign keys use that existing identity. New routes use the existing LOTOTO role lists. Do not add a second login in front of Keycloak.

## Standards

Build one generic point record. Industry practice then uses the fields it needs.

- HSG 253 for the isolation scheme: method, points, proving, locks, and the certificate.
- OSHA 1910.147 for general-industry lockout, including removal of another person’s lock.
- OSHA 1926 for construction.
- NFPA 70E for electrical prove-dead.
- A process plant uses blinds and double block and bleed. A data centre uses electrical points and a lockbox. A construction site often uses one lock and one tag. The same point record covers them.

## Corrected tasks

### TASK-LOTOTO-01 — Certificate copies the procedure

Finish the certificate as the live isolation of one asset or one work location, matching the procedure rule already in force.

- On approval, copy the published points and both sequences onto the certificate. Later edits to the template do not change the live copy.
- Status cannot reach `isolated_verified` until every point has a passing try-out.
- Keep the certificate lifecycle. Do not add a permit status.
- Register migration `0089` in the journal.

### TASK-LOTOTO-02 — Several permits, same permit steps

Several permits may attach to one certificate. The permit screen does not change.

- The first permit walks the apply steps. A later permit sees those steps already passed.
- Start of work still requires the apply Pass. Do not replace that check with a certificate status alone.
- Restoration still requires the remove Pass. Do not return early from `assertRestorationComplete` when a certificate is attached.
- Restoration stays blocked until every attached permit has finished work.
- Register migration `0090` in the journal.

### TASK-LOTOTO-03 — Proof that matches the energy

Try-out is recorded on the point.

- Electrical proof is Live-Dead-Live: prove the meter on a known live source, prove the equipment dead, prove the meter again. Store the meter, its serial number, and its calibration date. A row of zeros is not a pass.
- Pressure proof is a gauge reading plus vent and bleed.
- Mechanical proof is no movement, with a pin or block where the procedure requires it.
- A gas test on the permit stays a gas test. It is not the isolation proof.
- Reject a try-out whose calibration date has passed.
- The certificate cannot be called verified until every point has passed.
- Register migration `0091` in the journal.

### TASK-LOTOTO-04 — Personal lock first, lockbox when a crew shares the plant

- The normal job is one authorised person locking the device and fitting a danger tag. Store the lock number and the tag number on that point when the step is ticked.
- A lockbox is optional. The isolation authority locks the plant, the keys go in the box, and each person adds a personal lock to the box.
- Keys cannot be released while any personal lock is still on the box.
- The person who proves the point dead is recorded separately from the person who applied the lock. A site may allow one authorised person to do both. That choice is a written site rule.
- Register migration `0092` in the journal.
- The screen for this task is part of task 12, not a separate product.

### TASK-LOTOTO-05 — Blinds are points

- A blind, spade, or spectacle plate is an isolation point with extra fields: line number, P&ID reference, type, flange rating, size, thickness, torque, and gasket replaced.
- The blind row points at that isolation point.
- Restoration stays blocked while a blind on the certificate is still installed.
- Register migration `0093` in the journal.

### TASK-LOTOTO-06 — Sanction for test

A motor bump or a pressure test opens only the named points. Every other point stays locked.

- Record the reason, the points opened, the area-clearance check, who authorised it, and the try-out after the test.
- Work does not resume until zero energy is proved again on the opened points.
- Use the permit suspension and revalidation that already exist when people must stop work. Do not set permit status from the isolation service.
- Add the migration only after `0089`–`0093` are in the journal. The table file `isolation-sanction-test.ts` is a start, not a finished task.

### TASK-LOTOTO-07 — Another person’s lock

Removing a lock whose owner is absent is an exception record, not a delete.

- Record the attempt to reach the person, the check that they are clear of the plant, and two authorisers drawn from roles this tenant already has.
- Tell that person before they next work on the tenant.
- Do not add a login wall in front of Keycloak.

### TASK-LOTOTO-08 — Shift handover

- The incoming person accepts the named points, locks, and keys.
- The joint inspection starts unticked.
- One transaction records the transfer. The history shows who held the isolation at each time.

### TASK-LOTOTO-09 — Long-term isolation

- A certificate that will stay on for weeks is marked long-term, with a reason and an audit interval. The columns already exist on `isolation_certificates`.
- It leaves the daily board and stays on a long-term register.
- Each walk is a stored record. A BullMQ job reminds the area authority when the next walk is due. A missed notice does not change the isolation.

### TASK-LOTOTO-10 — SIMOPS

- Raise a SIMOPS conflict when an isolation is venting, draining, or otherwise open beside other work.
- A tight, locked isolation is not by itself a reason to stop nearby permits.
- The existing safety-officer review path stays. Do not add a second blocker.

### TASK-LOTOTO-11 — Certificate list

Add `/lototo/certificates` inside the existing LOTOTO area.

- Show certificate number, asset or location, energy types, status, attached permit count, isolation authority, and how long it has been on.
- Filters: all, in progress, verified, under test, long-term.
- “New isolation” starts from a published procedure for one asset or one work location.
- Use the existing design tokens, Shadcn/UI, and Lucide icons. Status is never colour alone.

### TASK-LOTOTO-12 — Certificate workbench

`/lototo/certificates/[id]` has these tabs:

- Overview: target, procedure version copied, boundary, attached permits.
- Points: the copied points and both sequences, with lock number, tag number, who applied, and who proved.
- Try-out: the proof for each point, including Live-Dead-Live where the energy is electrical.
- Lockbox: shown only when this certificate uses a box. Roster of personal locks.
- Blinds: the points that are blinds, and whether each is installed or removed.
- Permits: permits attached to this isolation.
- History: append-only. No edits to a passed try-out. A correction is a new event.

### TASK-LOTOTO-13 — Permit screen stays

Keep `frontend/src/components/permit/lototo-execution.tsx` as the operator’s two-phase list.

- Apply phase before start. Remove phase after the work is marked complete.
- When the permit is the one performing a shared isolation, those ticks write the certificate points.
- When the isolation is already verified, the apply steps show as already passed. If a lockbox is in use, the extra action is “Apply my personal lock”, with the lock number.
- The remove phase remains the restoration. It does not appear as finished merely because a certificate row exists.
- Mobile uses the same rule. Do not add a camera library in this task.

### TASK-LOTOTO-14 — Field identity, after the points exist

- The mobile permit screen follows task 13.
- Offline queuing of step ticks waits until the point record is the one record.
- A scanned code fills a lock number or a point code for a signed-in user. Choose the scanner only when this task starts. Do not add a dependency before then.

### TASK-LOTOTO-15 — Printed sheet and danger tag

- The lock number and tag number already live on the point from task 04.
- Print the isolation sheet and a danger tag from that record.
- A QR code opens the point only for a signed-in user. It is not a public link.

## Order

1. Put `0089`–`0093` in the migration journal and correct the permit-close bypass in task 02.
2. Make the certificate copy points and sequences, and require try-out before verified (tasks 01 and 03).
3. Personal lock, optional lockbox, blinds as points (tasks 04 and 05).
4. Certificate list and workbench, then keep the permit screen on those records (tasks 11, 12, and 13).
5. Sanction for test, another person’s lock, handover, long-term isolation, and SIMOPS (tasks 06–10).
6. Mobile scanning and printed tags (tasks 14 and 15).

Do not reseed. Do not change permits that have LOTOTO turned off. Do not deploy until asked.
