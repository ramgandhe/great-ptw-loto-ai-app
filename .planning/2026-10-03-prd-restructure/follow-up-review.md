# PermitWiseAI v0.2 follow-up review

Date: 2026-10-04

**Verdict: changes needed before approval.** Nine findings: six P1 (high priority), three P2 (medium priority). Standards: two findings. Spec: seven findings.

Reviewed the current `docs/specs/2026-10-04-permitwiseai-v2-prd.md` and `review-log.md`, with the prior reviewer reports, cross-votes, owner decisions, v1 requirements and repository instructions. Two independent reviewers covered standards/security and domain/specification; the coordinating reviewer checked their findings and delivery/offline consistency. Findings concern requirements, not defects demonstrated in an implemented v2 system. Line references refer to the draft reviewed on this date.

The historical tally is correct: 45 findings, comprising 16 blockers, 26 majors and three minors. Applying their proposed text did not resolve every interaction between the amendments. The findings below reopen those interactions; they do not replace the original votes or claim a new cross-vote has occurred. No PRD requirements were changed.

## Standards

### STD-01 — P1: Engagement expiry removes promised emergency access

**Location:** [NFR-SEC-002, PRD line 535](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:535); FR-AGY-006/008/009 and FR-PRV-006.

The client-to-agency data path requires an active engagement. Only the opposite path, agency-to-client, explicitly allows wind-down. However, FR-PRV-006 promises emergency-subset access during making safe and for 72 hours after an incident, regardless of permit status. If an engagement ends during that window, the client's required database access is denied. Client snapshots cannot supply the missing information because they exclude emergency and contact data.

**Required correction:** Define a narrowly scoped client emergency-access path for unfinished making-safe work and the incident window, preserving recipient limits and access logging. Keep agency account revocation independent of this client-side access.

**Verify:** End an engagement during an incident response; authorised client responders retain the specified access, while unrelated staff records and agency access remain restricted.

**Prior outcomes affected:** R2-03, R1-07, R1-14; C2, C10, C11.

### STD-02 — P2: Offline health caches outlive the withdrawal deadline

**Location:** [FR-PRV-002, PRD line 465](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:465); FR-PRV-006, §18 Mobile (line 591), acceptance criterion 5.

Consent-dependent health data must be deleted within 24 hours of withdrawal. Offline emergency copies may remain until permit closure, sign-out or seven days without sync. A disconnected receiver's device has no specified expiry or deletion rule that enforces the shorter promise and can retain withdrawn data on day two.

**Required correction:** Reconcile the withdrawal deadline with a concrete offline expiry/deletion contract and emergency availability expectations. State what happens to disconnected copies and on reconnection.

**Verify:** Withdraw consent while a receiver's device remains offline beyond 24 hours; validate the documented result for cached health data and continued emergency-contact availability.

**Prior outcomes affected:** R2-04, R2-10, R3-03; C5, C7, C11.

## Spec

### SPEC-01 — P1: The default Closure step fails rule check 11

**Location:** [Closure permissions, PRD line 217](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:217); default roles at lines 176–179, FR-WFD-003/007 and §9.1 check 11.

Closure part 2 requires both `verify restoration` and `accept closure`. The default Safety officer has the first; the default Coordinator has the second. No default role has both. Each part has one role and must receive all its required permissions from that role. The default workflow therefore cannot pass the check used at platform, organisation and legal-entity levels. The step description also explicitly names three participants although the step model allows only two parts.

**Required correction:** Represent restoration verification and closure acceptance as separate ordered actions/parts with the existing intended role owners; reconcile the step model and permission table.

**Verify:** The unmodified platform default passes all applicable rule checks and completes closure with Receiver, Safety officer and Coordinator performing their specified duties.

**Prior outcomes affected:** R1-13, R3-08; C9.

### SPEC-02 — P1: Shared isolations have no consistent close-out path

**Location:** [FR-LTO-103, PRD line 433](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:433); FR-PTW-010/011 at lines 414–415.

With permits A and B relying on one isolation point, restoration for A waits for B to be Closed, and restoration for B waits for A to be Closed. Neither may close until its isolations are restored. Making safe permits a verified transfer, but the closure guard does not recognise that alternative. Implementers must either preserve this deadlock or invent an exception.

**Required correction:** Distinguish releasing/transferring one permit's reliance from physically restoring the shared point. Make closure recognise an authorised release/transfer, and allow physical restoration only after the remaining dependencies and personal locks are cleared.

**Verify:** A finishes and closes while B remains safely isolated; restoration stays blocked until B's own close-out conditions are satisfied.

**Prior outcomes affected:** R1-03, R1-04.

### SPEC-03 — P1: First-day revalidation creates a workflow cycle

**Location:** [FR-CRW-006, PRD line 403](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:403); FR-WFE-001 (318), FR-PTW-007 (391), FR-MDP-101 (444).

On each day of a multi-day permit, revalidation must finish before check-in. Revalidation runs only inside Execution, but Execution cannot start until Issue's check-in finishes. There is no first-day exception, so the first check-in cannot satisfy all three rules.

**Required correction:** Explicitly define whether Issue's safety checks satisfy day-one revalidation or whether a first-day revalidation can run before initial check-in. Preserve the requirement that subsequent days are revalidated before entry.

**Verify:** A multi-day permit reaches its first check-in without bypassing a prerequisite, and day-two entry remains blocked until revalidation completes.

**Prior outcomes affected:** R1-01, R1-09.

### SPEC-04 — P1: Expired permits lose guaranteed close-out access

**Location:** [FR-PTW-012, PRD line 416](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:416); FR-AGY-008 (152), FR-ONB-013 (248–251), FR-PTW-013 (417).

Expiry preserves checkout, restoration and closure, but engagement wind-down, duty handover and trial protections enumerate only Issued, Active and Suspended. An Expired permit without an applied isolation can still contain checked-in crew when the trial's read-only period ends. The suspension rule then permits excluding non-admins even though that permit still requires close-out. Execution completed and Pending closure are also absent from those enumerations.

**Required correction:** Base close-out access and suspension prevention on unfinished safety obligations across all relevant statuses, including Expired and Pending closure. Apply the same definition to engagement end and handover.

**Verify:** Expire a permit with checked-in crew and no isolation, then end its engagement or advance the trial clock. Authorised people must still be able to complete the required close-out.

**Prior outcomes affected:** R1-03, R1-07, R1-10, R1-15, R3-13; C2, C3, C4.

### SPEC-05 — P1: End now assigns actions forbidden to the coordinator

**Location:** [FR-AGY-008, PRD line 153](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:153); FR-ROL-005(c) (192), default Coordinator permissions (176), FR-PTW-011 (415), review-log C2 (75).

End now removes agency access and makes the coordinator take the receiver part. The same coordinator account is always barred from receiver actions, including checking crew out and reporting completion, and its default role lacks checkout, completion and restoration permissions. Recording crew whereabouts alone does not supply restoration authority. This emergency fallback cannot execute under the stated permission rules.

**Required correction:** Route the receiver's close-out duties to an eligible independent internal receiver, with the coordinator arranging the handover. Keep restoration verification and closure acceptance independently authorised. Reconcile the C2 outcome with this executable path.

**Verify:** End now revokes the agency immediately, then internal personnel finish making safe with server-side permissions and segregation of duties enforced throughout.

**Prior outcomes affected:** R1-06, R1-07, R3-12; C2.

### SPEC-06 — P2: Offline replay has opposite tenant-switch requirements

**Location:** [FR-ONB-018, PRD line 259](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:259); §18 Mobile (591).

FR-ONB-018 requires queued actions to sync to their originating tenant whichever tenant is open. The architecture says they are sent only while their own tenant is active and the server rejects a session mismatch. After recording a checkout or stop-work event in A and switching to B, one requirement demands replay and the other delays it until switching back.

**Required correction:** Choose one observable behavior and align both sections. If replay continues while another tenant is displayed, specify a separately authenticated tenant context for that replay; do not weaken mismatch rejection.

**Verify:** Queue actions for A, switch to B, reconnect and assert the agreed replay behavior without executing an A action under B's context.

**Prior outcomes affected:** R2-10, R3-06; C7, C10.

### SPEC-07 — P2: Delivery exits still depend on later phases

**Location:** [Delivery table, PRD line 602](/home/pradnyaanambrahm/Documents/Projects/great-ptw-loto-ai-app/docs/specs/2026-10-04-permitwiseai-v2-prd.md:602); FR-PLC-006 (130), FR-CRW-006 (403), Phase 4/5 (604–605).

Phase 2 must produce a Live plant, but becoming Live requires workflow rule check 3, whose checker and workflow arrive in Phase 3. Phase 4 must demonstrate an agency crew working one permit for three days, but multi-day revalidation is scheduled in Phase 5. The note that the database reset makes v1 module screens unavailable rules out relying on those screens to satisfy the latter exit.

**Required correction:** Move the necessary checker/workflow and revalidation slices ahead of their dependent exits, or change those exits to match the delivered capability. State the dependency explicitly so phases can close without bypassing requirements.

**Verify:** Walk each phase's exit using only that phase and its predecessors, with no direct database edits or skipped workflow checks.

**Prior outcomes affected:** R2-13, R3-04; C6.

## Review disposition

All nine findings remain open. The original Applied labels describe historical edits, not clearance of these follow-up findings. Before approval, reconcile the contradictory requirements and update the corresponding acceptance scenarios and review outcomes. Proposed corrections have not been applied or cross-voted.

Validation performed: document and vote cross-reference, lifecycle walkthroughs, default-role permission comparison, and the historical finding tally. Application tests were not run; no application code changed. This review does not validate external legal compliance or the Keycloak spike.
