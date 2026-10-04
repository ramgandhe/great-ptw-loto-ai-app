R1-01: agree
R1-02: agree | A receiver handover (C4) is administrative, not a scope change, and end-time extensions follow the v1 extension flow, not the after-Issue scope lock.
R1-03: agree
R1-04: agree
R1-05: agree
R1-06: agree
R1-07: agree | Keep a client "End now" option (the agency's open permits are suspended at once and the coordinator takes over the receiver part) for cases such as misconduct.
R1-08: agree
R1-09: agree
R1-10: agree | A receiver handover within the same agency or internal crew does not restart approval (FR-WFE-006).
R1-11: agree | Crew without a sign-in account (R3-03) can acknowledge the briefing on the receiver's device, with their name and a tap or signature.
R1-12: agree
R1-13: agree
R1-14: agree
R1-15: agree
R2-01: agree
R2-02: agree
R2-03: agree | The agency work queue lists permits from every active engagement, each labelled with the client organisation and plant; agency staff sign in on mobile by email, without a slug (R3-06).
R2-04: agree | Also cover crew without email or sign-in (the admin records consent with the signed form), and ask again at the next sign-in when the wording changes (R3-03).
R2-05: agree
R2-06: agree | Renumber FR-ONB-017/018, which clash with R3-02 and R3-06; admins can resend an expired invitation.
R2-07: agree
R2-08: agree
R2-09: agree
R2-10: agree | Never wipe unsynced queued actions (after 7 days without a sync, wipe the cache and lock the app until sign-in); allow the emergency subset of crew checked in on the user's own permits in the encrypted store, wiped at permit close.
R2-11: agree | Renumber FR-PRV-011 to 014, which clash with R3-03's FR-PRV-011.
R2-12: agree
R2-13: agree | If Phase 1 becomes too large for the team, split it into 1a and 1b rather than moving security later.
R2-14: agree | Add the device and the list size from R3-14: a mid-range Android phone (4 GB RAM) and the first 50 queue items.
R2-15: agree
C1: R1-05 | Keep from R3-01: when agency staff hold the step, every level also notifies the agency's admins and role targets are resolved among the client's people at the plant; a target that is another role or a named person is offered the step only if they hold its permissions and SoD allows it; a step offered only to SoD-barred people escalates at once; admins can reassign; add the D-4 (NI-04) entry.
C2: merge | Use R1-07 for ending (no new check-ins, access only to finish safely, handover to an internal receiver, alerts, the NFR-SEC-002 addition). Add from R3-12: search for existing agencies and route by email domain (no duplicate agency tenants), nominated receivers changeable at any time, end-date warnings 14 days and 1 day before with extension, and "End now" (suspend at once).
C3: R1-15 | Keep from R3-13: a banner for every user naming the read-only state and the date of the next change, and permits not yet issued can only be cancelled. Keep from R2-05: a full export offered before deletion, with FR-AUD-003 worded to match the single deletion exception.
C4: merge | Use R1-10 for coordinator and receiver handover (state note, acceptance, admin reassign, shown in both work queues). Use R3-11 for substitutes and extra crew (who is eligible, an acceptance pool with a 30-minute target and the Issue step's escalation), plus R1-11's own-name briefing acknowledgement. A handover is administrative under FR-WFE-006 and never restarts approval.
C5: R2-04 | Keep from R3-03: crew-only people without email or sign-in (rewrite FR-ONB-010), admin-recorded consent with the signed form for them, asking again at the next sign-in when the wording changes, and consent and own profile in the mobile scope (UX-005).
C6: merge | Use R3-04 for the phase order (internal check-in and mobile in Phase 3, Phase 3 as the pilot slice, a note that v1 module screens are unavailable until Phase 5). Use R2-13 for the Phase 1 security foundations and the per-phase schema and isolation-suite exit criterion. Do not move security later; split Phase 1 if needed.
C7: merge | Use R3-05 for the flow: on-device certificate check against cached expiry dates, server re-check, "Refused on sync" and "Late sync", substitute "Waiting for coordinator", cross-device ordering by device time, bulk check-in, flag definition. Use R2-10 for the rebuilt store (encrypted, partitioned by account and tenant, tenant-tagged queue, §23.2 row) and R1-08 for offline actions on suspended permits. Unsynced actions are never discarded.
C8: R2-14 | Add from R3-14: a mid-range Android phone (4 GB RAM), the first 50 queue items, and 750 kbps up.
C9: merge | Use R3-08 as the base: step-needs table, default-permissions column, fixed admin roles, retire behaviour, sentence-case display names. Extend it with R1-13's added permissions, its defaults and FR-PTW-014 (cancel). R1-06's list of permissions agency roles cannot hold must agree with the table.
C10: R2-03 | An agency supervisor working for three clients gets one queue across all of them with no tenant switching, which is better on a phone on site than R3-06's per-tenant switching. It also matches FR-ONB-015 (agency theme), and the RLS paths are simpler. Keep from R3-06: client and plant labels on each item, email links that open the item directly, mobile sign-in by email, a tenant-tagged offline queue, and waiting counts in the switcher for people with records in several tenants.
C11: R1-14 + R2-08 | They do not conflict: use R1-14 for FR-PRV-006 (receiver added; visible from first Isolation or Issue until Closed, Rejected or Cancelled; 72 hours after an incident) and R2-08 for FR-PRV-005, 005a and 005b. Keep: the subset covers only people on that permit, every view is logged, and it is available offline for checked-in crew per the R2-10 amendment.
