R1-01: agree
R1-02: agree
R1-03: agree | For agency staff, enforce one check-in at a time through the agency's own attendance record (R2-09 FR-AGY-010) so neither client sees the other's permit; the offline headcount holds name, permit and place only, inside the encrypted store (R2-10).
R1-04: agree
R1-05: agree
R1-06: agree | Segregation of duties compares accounts, not person records, because one account can hold a client person record and an agency person record (R2-06 FR-PPL-004).
R1-07: agree | Wind-down access ends when the permit closes or the receiver duty is handed over, and the client keeps an "End now" that cuts access at once (see C2).
R1-08: agree
R1-09: agree
R1-10: agree
R1-11: agree | Crew-only records with no sign-in (R3-03) acknowledge the briefing on the receiver's device, recorded as such with the receiver as witness.
R1-12: agree | The nightly re-evaluation runs per tenant under NFR-SEC-008 (R2-02), never with a role that bypasses RLS.
R1-13: agree
R1-14: agree | The receiver sees it only for crew checked in that day; the notice (FR-PRV-001) names every recipient role; offline copies follow C11.
R1-15: agree | Add R2-05's 35-day backup limit and deletion ledger so a restore cannot bring back deleted data.
R3-01: agree | When the escalation target is a legal-entity admin, the admin can only reassign the step, never act on it (R1-05 FR-ROL-007).
R3-02: agree | Renumber FR-ONB-017; R2-06 also proposes FR-ONB-017 and FR-ONB-018.
R3-03: agree | Keep R2-04's lawful basis per data category and notice translations (DPDP s.5(3), s.6(3)); renumber FR-PRV-011, which R2-11 also uses.
R3-04: agree | The Phase 3 pilot holds real personal data, so the DPA, grievance contact and breach process (R2-11 FR-PRV-011 to 013) must be in place before it starts.
R3-05: agree | Keep the crew copy (names, photos, expiry dates) in R2-10's encrypted store, partitioned by account and tenant, and wipe it when the permit closes; store both device time and server receipt time.
R3-06: agree | An agency account may enter a client tenant only through an active engagement (or a permit in R1-07 wind-down), and inside it sees only the permits it is assigned to.
R3-07: agree
R3-08: agree
R3-09: agree
R3-10: agree
R3-11: agree
R3-12: agree | Route invitations by email domain only for domains the agency has verified, never for public mail providers (gmail.com and similar); agency search shows name and city only.
R3-13: agree
R3-14: agree
R3-15: agree
C1: merge | Base on R1-05: the check 4 rewrite, the default chain, FR-ROL-007 (admins hold no permit permissions) and D-4 for NI-04. Add from R3-01: FR-WFE-010 (reassign only to someone who holds the step's role); a target is offered the step only if it holds the needed permissions and FR-ROL-005 does not bar it; a barred step escalates at once; agency-held steps also notify the agency's admins.
C2: merge | Base on R1-07: wind-down access limited to the permit's own close-out actions, plus the NFR-SEC-002 clause. Add from R3-12: agency de-duplication (verified domains only), nomination changes, end-date notices at 14 days and 1 day, extension, and "End now" (permits suspended, coordinator takes the receiver part, agency access ends at once), which the client needs if an agency account is compromised.
C3: R1-15 | Add from R3-13: the banner, and "permits not yet issued can only be cancelled". Add from R2-05: the FR-AUD-003 rewording, export before deletion with the organisation keeping its safety records as controller, and the 35-day backup limit with deletion ledger. Must keep: no suspension while any permit is issued or any isolation is applied.
C4: merge | Base on R1-10: the incoming person accepts before the outgoing one is released; a receiver handover also needs the coordinator's acceptance; an admin reassigning gives a reason; every handover is recorded. Add from R3-11: who may be a substitute or extra crew member, a 30-minute target with escalation, briefing before check-in, and receiver handover within one agency treated as administrative under FR-WFE-006. Must keep: an agency receiver duty goes only to receivers nominated on the same engagement, and permit access moves with the duty.
C5: merge | Base on R2-04: lawful basis per data category, notice translations, paper consent, import that rejects consent-based columns, and withdrawal as easy as giving consent. Add from R3-03: crew-only records with no sign-in; on a wording change, people are asked again and the earlier consent stands until they answer; after withdrawal the emergency subset shows contacts only; consent on mobile; deletion within 24 hours of withdrawal.
C6: merge | Base on R3-04's table: check-in in Phase 3, mobile sign-in in Phase 1, a pilot at the end of Phase 3, v1 screens unavailable until Phase 5. Add R2-13's Phase 1 security items: API role and FORCE RLS, transaction-local context for requests and jobs, key service and personal-data service, audit writer, and the agency-path policy skeleton. Every phase's exit criteria include the schema test and isolation suite for its new tables. Must keep: health fields cannot be entered before consent records exist, and the pilot needs the DPA and breach process.
C7: merge | Use R2-10 for the store: encrypted, partitioned by account and tenant, wiped on sign-out and after 7 days without sync, tenant on every queued action, and the server refuses a tenant mismatch. Use R3-05 for check-in behaviour: crew copy, "Refused on sync", batch check-in, a substitute shown as waiting, and the ordering rule. Use R1-08 to flag actions on a permit already suspended, cancelled or expired. Store device time and server receipt time.
C8: merge | Use R3-14's device and network profile for the work queue and R2-14's load shape, measured as the API database role with RLS on and agency users included.
C9: merge | Base on R3-08: the step-needs table, default permission sets, fixed admin roles and sentence-case names. Add R1-13's permissions to FR-ROL-001, to the defaults and to the step-needs table. Must keep: R1-06's list of permissions an agency-holdable role may never contain; the defaults checked against the FR-ROL-005 pairs; reports that list people show assignment-card fields only (R2-08 FR-PRV-005a).
C10: R3-06 | With one tenant per session, every policy keeps `tenant_id = app.tenant_id` as a conjunct that the schema test can assert, and the agency path only narrows within that client (active engagement AND assigned to the permit). Under R2-03's model, client tables need a cross-tenant OR branch and one agency session spans several clients, which is harder to prove safe. Keep R2-03's path (b): the client reads agency staff only through the column-limited function, and only the personal-data service decrypts the emergency subset with the agency's key. Drop R2-03's FR-ONB-016 sentence in favour of R3-06's. The server derives an account's client tenants from active engagements only.
C11: merge | Use R2-08's FR-PRV-005, 005a and 005b for who sees what, with R1-14 as the new FR-PRV-006: receiver added; visible from the first Isolation or Issue until Closed, Rejected or Cancelled; 72 hours after an incident. Must keep: only people on that permit (for the receiver, crew checked in that day); every view logged; the notice names the recipients; medical emergency or vital interest recorded as the lawful basis (R2-04). Offline, the subset may be cached for checked-in crew of permits where the user holds a role, only in the encrypted store, wiped when the permit closes, with offline views logged at sync. This amends R2-10's "never cached offline", so data is there for a site emergency with no signal.
