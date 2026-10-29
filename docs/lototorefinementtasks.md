# Energy Isolation Management System (EIMS / LOTOTO) Refinement Roadmap

## Executive Summary

This roadmap defines the engineering tasks required to elevate the existing Permit-to-Work (PTW) LOTOTO module into an enterprise-grade **Energy Isolation Management System (EIMS)** operating under the **Energy Isolation Certificate (EIC)** model. 

The primary architectural shift establishes LOTOTO as a **standalone energy isolation subsystem**:
- Isolation exists as an independent entity (EIC) governing equipment and asset safety boundaries.
- Permits attach to and draw safety from the EIC, allowing single-permit or multi-permit group lockouts.
- **Zero disruption to existing PTW operations**: Permits where `lototoRequired = false` remain completely unaffected.
- **100% preservation of operator experience**: For `lototoRequired = true`, operators continue to sequentially tick apply steps $\rightarrow$ verify pass $\rightarrow$ start work $\rightarrow$ finish work $\rightarrow$ sequentially tick remove steps $\rightarrow$ verify pass $\rightarrow$ close permit.
- Provides deep multi-industry compliance (OSHA 1910.147, NFPA 70E, ANSI Z244.1, API RP 76, IEC 60079) across Oil & Gas, Chemicals, Power & Utilities, Data Centers, Mining, Rail, Marine, and Manufacturing.

---

## Task Summary Table

| Task ID | Title | Module / Layer | Primary Focus |
| :--- | :--- | :--- | :--- |
| **TASK-LOTOTO-01** | Standalone Energy Isolation Certificate (EIC) Data Model & Lifecycle | Backend (Database & Core) | Unify schemas; establish independent EIC state machine |
| **TASK-LOTOTO-02** | Multi-Permit Association & Safety Gate Integration | Backend (PTW & LOTOTO) | Permit linking, unlinking, and bidirectional lifecycle gates |
| **TASK-LOTOTO-03** | Structured Zero-Energy Verification (Tryout / ZVE) Engine | Backend & Storage | Parameterized Live-Dead-Live, bleed, jog tests & photo proof |
| **TASK-LOTOTO-04** | Group Lockout & Lockbox (Key Safe) Subsystem | Backend & UI | Master keys in box, individual personal locks register |
| **TASK-LOTOTO-05** | Mechanical Blind & Spade Tracking Register | Backend & UI | Process piping blinds install/torque & mandatory removal checks |
| **TASK-LOTOTO-06** | Sanction for Test (Temporary De-isolation / Bump Testing) | Backend & Safety Gates | Controlled motor bump / hydrotest without permit recreation |
| **TASK-LOTOTO-07** | Emergency & Abandoned Lock Removal Protocol | Backend & Compliance | OSHA 1910.147(e)(3) multi-signature override procedure |
| **TASK-LOTOTO-08** | Shift Handover & Isolation Transfer Management | Backend & Audit | Custody handover between outgoing & incoming isolation authorities |
| **TASK-LOTOTO-09** | Long-Term Isolation (LTI) & Mothballing Register | Backend & Jobs | Isolations exceeding 30 days with recurring BullMQ audit alerts |
| **TASK-LOTOTO-10** | SIMOPS Cross-Isolation Conflict Detection Integration | Backend (SIMOPS) | Detect overlapping permits operating near active isolated boundaries |
| **TASK-LOTOTO-11** | Standalone EIC Management Console (`/lototo/certificates`) | Frontend (App Router) | Control room overview of plant energy isolation states |
| **TASK-LOTOTO-12** | Comprehensive Isolation Workbench & Tabbed Interface | Frontend (Components) | P&ID viewer, points register, tryout, lockbox, blind tables |
| **TASK-LOTOTO-13** | Backwards-Compatible Permit Operator Execution View | Frontend (Permit UI) | Seamless sequential apply/remove step ticking on permit screen |
| **TASK-LOTOTO-14** | Mobile Offline Sync & Barcode/QR Scanning | Mobile (React Native) | Field isolation execution without network in substations/tanks |
| **TASK-LOTOTO-15** | Printable EIC Documentation, Blind Manifest & Scannable Danger Tags | Backend & Reporting | Thermal tag and PDF export with verifiable QR codes |

---

## Detailed Task Specifications

### TASK-LOTOTO-01: Standalone Energy Isolation Certificate (EIC) Data Model & Lifecycle

#### 1. Context & Background
Currently, the codebase contains two fragmented models: `lototo_plans` (legacy register in `app/src/database/schema/lototo.ts`) and `lototo_procedures` (SOP templates in `app/src/database/schema/lototo-procedure.ts`), with `permit_lototo_instances` strictly locked 1:1 to a single `permit_id`. In real industrial operations, an isolation often spans multiple permits or exists prior to permit creation. We must establish an independent, authoritative `isolation_certificates` table that acts as the operational instance of an approved isolation procedure.

#### 2. Detailed Description
Create the `isolation_certificates` table and lifecycle state machine. An EIC is an operational document that isolates an asset, system, or work location. It can be instantiated directly from an approved `lototo_procedure` template or created ad-hoc for non-standard outages.

#### 3. Detailed Implementation Instructions
- **Database Schema (`app/src/database/schema/isolation-certificate.ts`):**
  - Define table `isolation_certificates`:
    - `id` (UUID, primary key)
    - `tenantId` (UUID, references `tenants.id`)
    - `certificateNumber` (varchar 32, unique per tenant, e.g., `EIC-2026-0001`)
    - `title` (varchar 255)
    - `discipline` (enum: `electrical`, `mechanical`, `process`, `combined`, `instrumentation`)
    - `status` (enum: `draft`, `pending_approval`, `approved`, `isolation_in_progress`, `isolated_verified`, `sanction_for_test`, `restoration_in_progress`, `restored_verified`, `closed`)
    - `procedureId` (UUID, nullable, references `lototo_procedures.id`)
    - `procedureVersionId` (UUID, nullable, references `lototo_procedure_versions.id`)
    - `assetId` (UUID, nullable, references `assets.id`)
    - `workLocationId` (UUID, references `work_locations.id`)
    - `lockboxId` (UUID, nullable, references new `isolation_lockboxes.id`)
    - `isolationAuthorityId` (UUID, references `workforce_users.id`)
    - `isolatedAt`, `verifiedAt`, `restoredAt`, `closedAt` (timestamps with timezone)
    - Standard audit columns (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`).
  - Define index on `(tenantId, status)` and unique index on `(tenantId, certificateNumber)`.
- **Backend Service & Controller:**
  - Create `app/src/modules/isolation-certificate/isolation-certificate.service.ts` handling EIC creation, state transitions, and template instantiation.
  - Expose endpoints in `app/src/modules/isolation-certificate/isolation-certificate.controller.ts`:
    - `POST /api/v1/isolation-certificates` (Create EIC)
    - `GET /api/v1/isolation-certificates` (Filter by status, asset, location)
    - `GET /api/v1/isolation-certificates/:id` (Detailed view)
    - `PATCH /api/v1/isolation-certificates/:id/transition` (State transition validation)

#### 4. Expected System Behavior
- Users can create a standalone Energy Isolation Certificate independently of any active permit.
- Instantiating from an approved LOTOTO procedure copies all published lockout points, sequences, and devices into the active certificate.
- The state machine blocks invalid transitions (e.g., cannot move from `isolation_in_progress` to `isolated_verified` without tryout completion).

---

### TASK-LOTOTO-02: Multi-Permit Association & Safety Gate Integration

#### 1. Context & Background
Currently, permits link directly to an isolation instance via `permitLototoInstances`. If three separate permits (scaffolding, mechanical line break, electrical disconnection) work on the same pump, the current app requires duplicate isolations. We need an association engine that lets multiple permits bind to the same EIC, while ensuring strict safety gates prevent de-isolation while any permit is still working.

#### 2. Detailed Description
Create the `isolation_certificate_permits` junction table and integrate bidirectional safety gates in `PermitLototoExecutionService`:
1. Permit work-start gate: Permit cannot move to `active` unless all linked EICs are in `isolated_verified` state.
2. Permit closure gate: EIC cannot move to `restoration_in_progress` until every attached permit has reached `execution_completed` or `closed`.

#### 3. Detailed Implementation Instructions
- **Database Schema (`app/src/database/schema/isolation-certificate-permits.ts`):**
  - Define table `isolation_certificate_permits`:
    - `id` (UUID, primary key)
    - `tenantId` (UUID, references `tenants.id`)
    - `certificateId` (UUID, references `isolation_certificates.id`, cascade delete)
    - `permitId` (UUID, references `permits.id`, cascade delete)
    - `attachmentStatus` (enum: `attached`, `active_work`, `detached`)
    - `attachedAt` (timestamp)
    - `attachedBy` (UUID)
    - `detachedAt` (timestamp, nullable)
    - `detachedBy` (UUID, nullable)
  - Unique constraint on `(certificateId, permitId)`.
- **Gate Service Refactoring (`app/src/modules/permit/permit-lototo-execution.service.ts`):**
  - Update `assertIsolationReadyToStart(permitId)`:
    - If `permit.lototoRequired === false`, resolve immediately.
    - If `permit.lototoRequired === true`, fetch all linked EICs via `isolation_certificate_permits`.
    - Verify that every linked EIC has status `isolated_verified`. If not, throw `ConflictException('Energy isolation EIC-{number} is not in verified zero energy state')`.
  - Update `assertRestorationComplete(permitId)`:
    - Verify that permit work is marked complete before allowing EIC restoration.
  - Create `assertCanStartRestoration(certificateId)`:
    - Query all permits attached to `certificateId` where `attachmentStatus != 'detached'`.
    - If any attached permit is in status `active` or `suspended`, throw `ConflictException('Cannot restore isolation: Permit {permitNumber} is still active on this equipment')`.

#### 4. Expected System Behavior
- One master isolation can protect multiple permits simultaneously.
- No permit can begin hazardous work until the master isolation is verified zero-energy.
- Equipment cannot be de-isolated or re-energized while any technician or crew is still actively working under an attached permit.

---

### TASK-LOTOTO-03: Structured Zero-Energy Verification (Tryout / ZVE) Engine

#### 1. Context & Background
In current code, verification is recorded as a simple text `reading` and boolean `try_out_completed`. Industrial standards (OSHA 1910.147, NFPA 70E Article 120) mandate structured verification protocols: Live-Dead-Live 3-point voltage tests, pressure line bleeds, local jog/bump tests, and calibrated instrument tracking.

#### 2. Detailed Description
Enhance `isolation_verifications` to support typed, parameter-driven Zero-Energy Verification (ZVE) with mandatory photographic proof and instrument calibration auditing.

#### 3. Detailed Implementation Instructions
- **Database Schema Modification (`app/src/database/schema/lototo-execution.ts` or new `isolation-verifications.ts`):**
  - Add structured fields to `isolation_verifications`:
    - `verificationCategory` (enum: `electrical_live_dead_live`, `pressure_bleed_vent`, `mechanical_jog_tryout`, `chemical_sniff_purge`, `stored_energy_block`)
    - `instrumentMakeModel` (varchar 128, nullable)
    - `instrumentSerialNo` (varchar 128, nullable)
    - `calibrationExpiryDate` (date, nullable)
    - `readingsPayload` (JSONB):
      - For Electrical: `{ phaseL1L2: 0, phaseL2L3: 0, phaseL3L1: 0, phaseL1N: 0, phaseL1G: 0, units: 'V' }`
      - For Pressure: `{ residualPressure: 0, units: 'PSI' | 'bar', ventOpen: true, bleederOpen: true }`
      - For Chemical: `{ lelPercent: 0, toxicPpm: 0, gasType: 'H2S' | 'CO' | 'VOC' }`
      - For Mechanical: `{ localButtonDepressed: true, zeroMovementConfirmed: true, blockPinInserted: true }`
    - `photoStorageKey` (varchar 512, MinIO key for zero-meter display / locked position)
    - `photoChecksum` (varchar 128, SHA256 of uploaded image)
- **Validation Logic:**
  - Create `ZveValidationService` ensuring readings equal zero where physical zero state is required.
  - Reject verification if `calibrationExpiryDate < currentDate`.

#### 4. Expected System Behavior
- Electrical isolation requires verifiable proof of a Live-Dead-Live test.
- The system stores immutable photographic proof of meters reading 0.00 V or gauges at 0.0 PSI.
- Provides a legally defensible digital audit trail conforming to OSHA and NFPA 70E requirements.

---

### TASK-LOTOTO-04: Group Lockout & Lockbox (Key Safe) Subsystem

#### 1. Context & Background
In large industrial facilities, it is physically impossible to place 10 or 20 individual contractor padlocks on a single circuit breaker or valve handle. Industry standard practice uses a **Group Lockbox (Key Safe)**: The Authorized Isolation Authority applies master padlocks to all field points, places all keys inside a numbered Lockbox, seals the box with a Master Lock, and all technicians attach their personal locks to the lockbox hasp.

#### 2. Detailed Description
Implement a complete Group Lockout & Lockbox management subsystem supporting physical lockbox tracking, key custody logs, and personal lock rosters for all workers on site.

#### 3. Detailed Implementation Instructions
- **Database Schema (`app/src/database/schema/isolation-lockbox.ts`):**
  - Define `isolation_lockboxes`:
    - `id` (UUID, primary key)
    - `tenantId` (UUID)
    - `certificateId` (UUID, references `isolation_certificates.id`)
    - `boxNumber` (varchar 64, e.g., `LBX-SUB02-04`)
    - `locationDescription` (text, e.g., `Permit Control Board Substation 2`)
    - `masterLockSerial` (varchar 64)
    - `custodyStatus` (enum: `open_for_keys`, `keys_deposited_sealed`, `keys_released`)
    - `sealedAt` (timestamp with timezone, nullable)
    - `sealedBy` (UUID, references `workforce_users.id`, nullable)
  - Define `lockbox_crew_locks` (personal lock sign-in/out):
    - `id` (UUID, primary key)
    - `lockboxId` (UUID, references `isolation_lockboxes.id`, cascade delete)
    - `permitId` (UUID, references `permits.id`)
    - `workforceUserId` (UUID, references `workforce_users.id`)
    - `personalLockNumber` (varchar 64, padlock badge/serial)
    - `appliedAt` (timestamp with timezone, default now)
    - `removedAt` (timestamp with timezone, nullable)
    - `removedBy` (UUID, nullable)
- **Business Logic & Gates:**
  - Add validation: An EIC cannot have its lockbox unsealed or its keys released if there are any active rows in `lockbox_crew_locks` where `removedAt IS NULL`.

#### 4. Expected System Behavior
- Operators place isolation keys in a physical lockbox and record the box sealing in the app.
- Every contractor or technician logs their personal safety padlock on the lockbox via their mobile or permit screen before entering the hazard area.
- Equipment cannot be de-isolated until every single worker has removed their personal lock.

---

### TASK-LOTOTO-05: Mechanical Blind & Spade Tracking Register

#### 1. Context & Background
In process industries (Oil, Gas, Petrochem, Pharmaceuticals), block valves can weep or leak through their seats. Positive physical isolation requires inserting solid steel slip blinds or turning spectacle spades. Leaving a blind installed after maintenance can cause pumps to deadhead or pipes to burst upon startup.

#### 2. Detailed Description
Create a dedicated Mechanical Blind & Spade Tracking Register integrated directly into the EIC. Blinds must be tracked through planned location, physical installation, torque verification, and mandatory removal verification prior to de-isolation.

#### 3. Detailed Implementation Instructions
- **Database Schema (`app/src/database/schema/isolation-blinds.ts`):**
  - Define `isolation_blinds`:
    - `id` (UUID, primary key)
    - `tenantId` (UUID)
    - `certificateId` (UUID, references `isolation_certificates.id`, cascade delete)
    - `blindTagNumber` (varchar 64, unique per tenant)
    - `lineTagNumber` (varchar 128, e.g., `12"-HC-1002-316L`)
    - `pidReference` (varchar 128, e.g., `PID-U10-04-REV2`)
    - `blindType` (enum: `slip_blind`, `spectacle_blind`, `pancake_blind`, `spade`)
    - `flangeRating` (varchar 64, e.g., `Class 300 ANSI RF`)
    - `blindSize` (varchar 64, e.g., `6 inch`)
    - `materialThickness` (varchar 64, e.g., `12mm 316SS`)
    - `status` (enum: `planned`, `installed_torqued`, `removal_verified`)
    - `installedAt` (timestamp, nullable), `installedBy` (UUID, nullable)
    - `installedTorqueNm` (numeric, nullable)
    - `removedAt` (timestamp, nullable), `removedBy` (UUID, nullable)
    - `gasketReplaced` (boolean, default false)
- **Lifecycle Gate:**
  - In `assertCanStartRestoration()`, query `isolation_blinds`. If any row has `status != 'removal_verified'`, block restoration with: `Cannot re-energize: Mechanical blind {blindTagNumber} remains installed on line {lineTagNumber}`.

#### 4. Expected System Behavior
- Process engineers track every physical blind inserted into plant piping.
- The system blocks de-isolation until every blind has its removal logged, torque inspected, and new gasket installation verified.

---

### TASK-LOTOTO-06: Sanction for Test (Temporary De-isolation / Bump Testing)

#### 1. Context & Background
During rotating machinery overhaul (pumps, compressors, conveyors), electrical technicians must briefly energize the motor to verify direction of rotation ("bump test") before coupling it to the load. Currently, the system has no way to do this without either falsifying records or completely closing and recreating the permit.

#### 2. Detailed Description
Implement a formal "Sanction for Test" (Temporary De-isolation) sub-lifecycle:
1. Suspend all linked active permits.
2. Confirm area clearance and remove specific test locks.
3. Energize equipment under controlled supervision for testing.
4. Return to zero energy state, re-apply locks, re-verify tryout, and resume work permits.

#### 3. Detailed Implementation Instructions
- **Database Schema (`app/src/database/schema/isolation-sanction-test.ts`):**
  - Define `isolation_sanction_tests`:
    - `id` (UUID, primary key)
    - `certificateId` (UUID, references `isolation_certificates.id`)
    - `testReason` (text, e.g., `Motor rotation check & vibration baseline`)
    - `authorizedBy` (UUID, references `workforce_users.id`)
    - `startedAt` (timestamp)
    - `completedAt` (timestamp, nullable)
    - `pointsTemporarilyDeisolated` (JSONB array of isolation point IDs)
    - `preTestSafetyChecklist` (JSONB)
    - `postTestZeroEnergyVerified` (boolean, default false)
    - `postTestVerifierId` (UUID, nullable)
- **Permit Integration Logic:**
  - When Sanction for Test starts, update all linked permits to status `suspended` with reason: `Equipment undergoing Sanction for Test`.
  - When test ends and zero-energy is re-verified, permits can be revalidated and returned to `active`.

#### 4. Expected System Behavior
- Safe, compliant motor bumping and pressure testing without deleting or restarting permits.
- Automatically suspends work permits during testing to protect technicians, and resumes only after full re-isolation is proven.

---

### TASK-LOTOTO-07: Emergency & Abandoned Lock Removal Protocol

#### 1. Context & Background
OSHA 29 CFR 1910.147(e)(3) strictly governs what must happen when a lock must be removed but the employee who applied it is not available (went home, sick, emergency). The employer must follow specific steps to guarantee the employee's safety before removing the lock.

#### 2. Detailed Description
Implement the OSHA-compliant Abandoned/Emergency Lock Removal workflow with multi-signature authorization and automated employee re-entry notification.

#### 3. Detailed Implementation Instructions
- **Database Schema (`app/src/database/schema/isolation-emergency-removal.ts`):**
  - Define `isolation_emergency_lock_removals`:
    - `id` (UUID, primary key)
    - `tenantId` (UUID)
    - `certificateId` (UUID)
    - `lockTagId` (varchar 64)
    - `missingWorkerId` (UUID, references `workforce_users.id`)
    - `absenceVerified` (boolean, security/badge out confirmed)
    - `contactAttemptDetails` (text, phone/radio attempts documented)
    - `equipmentInspectedClear` (boolean, physical walkaround done)
    - `facilityManagerApprovalId` (UUID, references `workforce_users.id`)
    - `hseDirectorApprovalId` (UUID, references `workforce_users.id`)
    - `removalTimestamp` (timestamp with timezone, default now)
    - `workerBriefedUponReturn` (boolean, default false)
    - `workerBriefedAt` (timestamp, nullable)
- **Notification & User Block:**
  - Create a login interceptor: If a user with a pending emergency removal logs in, display a mandatory full-screen alert requiring them to report to the Safety Office before accessing permits.

#### 4. Expected System Behavior
- No lock can be cut or removed without documenting employee absence, contact attempts, and obtaining dual management digital signatures.
- Missing workers receive an immediate mandatory notification before resuming work.

---

### TASK-LOTOTO-08: Shift Handover & Isolation Transfer Management

#### 1. Context & Background
Industrial maintenance frequently extends across 12-hour shifts. The outgoing Authorized Isolation Authority (AIA) must transfer custody of active isolations to the incoming AIA without any momentary lapse in safety.

#### 2. Detailed Description
Implement a Shift Handover and Transfer Lock protocol allowing an incoming AIA to inspect and assume responsibility for active EICs and Lockboxes.

#### 3. Detailed Implementation Instructions
- **Database Schema (`app/src/database/schema/isolation-shift-handover.ts`):**
  - Define `isolation_shift_handovers`:
    - `id` (UUID, primary key)
    - `certificateId` (UUID, references `isolation_certificates.id`)
    - `outgoingAuthorityId` (UUID, references `workforce_users.id`)
    - `incomingAuthorityId` (UUID, references `workforce_users.id`)
    - `handoverTimestamp` (timestamp with timezone, default now)
    - `jointInspectionCompleted` (boolean, default true)
    - `integrityNotes` (text)
    - `activePermitsReviewed` (boolean, default true)
    - `incomingSignature` (varchar 255)
- **API Endpoint:**
  - `POST /api/v1/isolation-certificates/:id/shift-handover` executing the transfer in a single atomic database transaction.

#### 4. Expected System Behavior
- Complete operational continuity across shift changes.
- Clear, auditable legal custody of who is responsible for plant energy isolation at any minute of the day.

---

### TASK-LOTOTO-09: Long-Term Isolation (LTI) & Mothballing Register

#### 1. Context & Background
Equipment undergoing major capital overhauls, awaiting obsolete spare parts, or mothballed may remain locked out for months. Such isolations must not clutter daily active permit boards, but must be tracked on an LTI register with recurring safety audits.

#### 2. Detailed Description
Create an LTI Register with automated 30-day recurring physical re-audit reminders powered by BullMQ.

#### 3. Detailed Implementation Instructions
- **Backend Schema & Service:**
  - Add to `isolation_certificates`:
    - `isLongTerm` (boolean, default false)
    - `ltiReason` (text, nullable)
    - `ltiAuditIntervalDays` (integer, default 30)
    - `nextAuditDueDate` (date, nullable)
    - `lastAuditedAt` (timestamp, nullable)
  - Create `LtiAuditJob` in `app/src/modules/lototo/lototo-jobs.service.ts`:
    - Daily scheduled BullMQ task checking for EICs where `isLongTerm = true AND nextAuditDueDate <= today`.
    - Dispatches notifications to Area Authorities to re-inspect physical tags and locks.

#### 4. Expected System Behavior
- Safely separates dormant isolations from active daily maintenance.
- Automatically prompts safety officers to conduct mandatory monthly field audits of mothballed padlocks and tags.

---

### TASK-LOTOTO-10: SIMOPS Cross-Isolation Conflict Detection Integration

#### 1. Context & Background
The existing SIMOPS module (`app/src/modules/simops`) evaluates permit schedule and location overlaps. An active isolation boundary can create a severe SIMOPS hazard (e.g., hot work permit submitted next to an open, vented hydrocarbon line under isolation).

#### 2. Detailed Description
Extend the SIMOPS conflict detection engine to cross-reference active EICs and flag high-severity conflicts when proposed work encroaches on active isolation vents, drains, or boundaries.

#### 3. Detailed Implementation Instructions
- **SIMOPS Service Update (`app/src/modules/simops/simops.service.ts`):**
  - In `evaluateConflicts(permitId)`:
    - Query active EICs in the same or parent `workLocationId`.
    - If the proposed permit involves Hot Work or Confined Space and the active EIC involves Flammable Gas, Toxic Chemical, or High-Voltage energy sources:
      - Automatically generate a `high` severity SIMOPS conflict: `Active Energy Isolation Conflict: EIC-{number} is venting or draining hazardous energy in this area`.
    - Block permit approval until Safety Officer reviews and resolves the conflict.

#### 4. Expected System Behavior
- Proactively stops dangerous simultaneous operations where hazardous energy being vented or isolated interacts with nearby permit work.

---

### TASK-LOTOTO-11: Standalone EIC Management Console (`/lototo/certificates`)

#### 1. Context & Background
Currently, the `/lototo` frontend route only displays the SOP Procedure Library. Control room operators and plant engineers need a dedicated dashboard to monitor live plant energy states across all units.

#### 2. Detailed Description
Build the `/lototo/certificates` frontend console displaying real-time isolation cards and tables with live status chips, active permit counts, and filterable energy types.

#### 3. Detailed Implementation Instructions
- **Frontend Page (`frontend/src/app/(app)/lototo/certificates/page.tsx`):**
  - Implement using existing design tokens, Tailwind, Shadcn/UI, and Lucide icons.
  - Features:
    - Metric summary cards: Total Active Isolations, Zero Energy Verified, Under Sanction for Test, LTI (>30 Days).
    - Data table with columns: EIC #, Asset / System, Energy Types, Current Status, Attached Permits Count, Isolation Authority, Duration.
    - Quick action: "New Energy Isolation" wizard.
    - Filter tabs: `All`, `Active`, `Zero Energy Verified`, `Under Test`, `Long-Term (LTI)`.

#### 4. Expected System Behavior
- Control room engineers gain immediate situational awareness of every energized and de-energized system across the facility.

---

### TASK-LOTOTO-12: Comprehensive Isolation Workbench & Tabbed Interface

#### 1. Context & Background
Detailed execution of an EIC involves multiple disciplines (electrical, mechanical, safety). A unified, tabbed workbench is required for managing points, readings, blinds, lockboxes, and permits.

#### 2. Detailed Description
Create the EIC detail view at `/lototo/certificates/[id]` featuring tabbed navigation: Overview, Lockout Register, Tryout & ZVE Console, Group Lockbox Roster, Blind Register, Attached Permits, and Audit History.

#### 3. Detailed Implementation Instructions
- **Frontend Page (`frontend/src/app/(app)/lototo/certificates/[id]/page.tsx`):**
  - Tabs implemented via Shadcn Tabs:
    - **Tab 1: Overview:** P&ID drawing viewer, equipment specs, isolation boundary summary.
    - **Tab 2: Lockout Register:** Point-by-point table showing lock tags, isolation devices, and execution timestamps.
    - **Tab 3: Zero-Energy Tryout:** Live-Dead-Live readings entry, pressure gauges, and MinIO photo evidence gallery.
    - **Tab 4: Group Lockbox:** Live roster of all contractor personal locks on the box with sign-in/out timestamps.
    - **Tab 5: Blind List:** Table of installed vs removed process piping blinds.
    - **Tab 6: Attached Permits:** List of all permits relying on this isolation with status badges.
    - **Tab 7: History:** Immutable append-only audit trail.

#### 4. Expected System Behavior
- Clean, accessible interface providing complete command and control over a complex multi-point industrial isolation.

---

### TASK-LOTOTO-13: Backwards-Compatible Permit Operator Execution View

#### 1. Context & Background
Operators are already accustomed to ticking apply sequence steps before work starts and remove sequence steps after work completes on the permit execution screen ([`lototo-execution.tsx`](file:///Users/vixrinc/Documents/MangoWorkspace/AgenticWorld/ptwlotoapp/greatptwlotoaiapp/frontend/src/components/permit/lototo-execution.tsx)). This workflow must not be disrupted.

#### 2. Detailed Description
Refactor `frontend/src/components/permit/lototo-execution.tsx` to seamlessly interface with the EIC backend while preserving 100% of the operator's sequential ticking flow.

#### 3. Detailed Implementation Instructions
- **Component Refactoring:**
  - Keep the familiar two-phase UI:
    - **Apply Phase (Before Start):** Operator sees sequence steps in order (1, 2, 3...). Ticking each step records the action. Verifier confirms Pass $\rightarrow$ Work can start.
    - **Remove Phase (After Completion):** Switched automatically when permit reaches `execution_completed`. Operator ticks de-isolation steps in order. Verifier confirms Pass $\rightarrow$ Permit can close.
  - Add seamless Group Lockout button:
    - A simple single-click action: `"Apply My Personal Lock to Lockbox"` with prompt for personal lock badge number.
  - If a permit attaches to an already-isolated EIC:
    - Display banner: `Isolated & Verified under EIC-2026-0012. You are protected by Lockbox LB-01.`
    - Operator skips redundant physical re-isolation and simply logs their personal lock on the lockbox.

#### 4. Expected System Behavior
- Zero learning curve for field operators.
- Faster, safer workflow: No duplicate isolation steps if the equipment is already safely isolated under a plant master certificate.

---

### TASK-LOTOTO-14: Mobile Offline Sync & Barcode/QR Scanning

#### 1. Context & Background
In remote switchyards, vessel interiors, and lower plant levels, mobile devices lose network connectivity. Operators must be able to verify points, scan QR tags, and take photos offline.

#### 2. Detailed Description
Implement offline SQLite caching and transaction queuing in the React Native mobile client (`mobile/src/lib/isolation-execution`), with QR/barcode hardware scanning.

#### 3. Detailed Implementation Instructions
- **Mobile Client Updates:**
  - SQLite schema caching active EIC points and verification steps.
  - Implement offline queue in `mobile/src/lib/work-queue.ts` storing step ticks, meter readings, and base64 photos locally when network is absent.
  - Integrate camera barcode scanner (`expo-camera` or `react-native-camera`) to scan QR codes on physical padlocks and isolation point placards.
  - Automatic background synchronization when cellular/Wi-Fi is re-established.

#### 4. Expected System Behavior
- Field operators can execute and verify isolations in underground substations and remote pump stations with zero network connection.
- Physical QR scanning eliminates manual typing errors on padlock serial numbers.

---

### TASK-LOTOTO-15: Printable EIC Documentation, Blind Manifest & Scannable Danger Tags

#### 1. Context & Background
Industrial regulations require physical danger tags attached to locks, and printed hard copies of the isolation certificate displayed in the control room or at the field lock station.

#### 2. Detailed Description
Create high-resolution PDF generation services for printable Energy Isolation Certificates, Blind Tracking Manifests, and thermal printer danger tags featuring QR codes.

#### 3. Detailed Implementation Instructions
- **Backend Reporting Service (`app/src/modules/lototo/lototo-report.service.ts`):**
  - Implement PDF generation using headless templates (HTML-to-PDF / Puppeteer or standard PDFKit):
    - **Document 1: EIC Master Certificate:** Complete overview of isolation points, energy sources, approvers, and attached permits.
    - **Document 2: Blind Manifest:** Table of all blinds with signoff columns for mechanical fitters and inspectors.
    - **Document 3: Scannable Danger Tags:** Standardized 3" x 6" "DANGER - DO NOT OPERATE" tag format containing Point Code, EIC #, Date, AIA Name, and a scannable QR code resolving to `https://app/lototo/verify/:tagId`.

#### 4. Expected System Behavior
- High-quality, printable documentation ready for control room permit racks and physical field attachment.
- Scanning a tag's QR code with any mobile device instantly displays its live safety status in the system.
