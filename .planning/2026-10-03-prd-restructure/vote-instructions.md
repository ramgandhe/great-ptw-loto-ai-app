# Round 2: cross-vote

Read the other two reviewers' files in this directory (reviewer-1.md: PTW domain and safety; reviewer-2.md: architecture, security and privacy; reviewer-3.md: UX, operations and delivery). Your own findings count as "agree" automatically; do not vote on them.

Rule the owner set: a change is applied only if at least 2 of the 3 reviewers agree with it.

Vote on every finding of the other two reviewers:
- agree: the problem is real and the proposed change (or something very close) should go into the PRD.
- disagree: the problem is not real, or the change is wrong or harmful. Give the reason.
- "agree-with-amendment" counts as agree; state the amendment in one line.

Then, for each cluster below, say which version to use as the base text (or "merge") and anything that must not be lost:
- C1 Default escalation / admin acting on permits: R1-05, R3-01
- C2 Engagement ending and engagement lifecycle: R1-07, R3-12
- C3 Trial expiry, suspension and deletion: R1-15, R3-13, R2-05 (FR-ONB-013 part)
- C4 Handover of coordinator/receiver duties, substitutes, extra crew: R1-10, R3-11
- C5 Consent and withdrawal: R2-04, R3-03
- C6 Delivery phase order: R2-13, R3-04
- C7 Offline check-in and the offline store: R3-05, R2-10, R1-08 (offline part)
- C8 Performance target: R2-14, R3-14 (NFR-PRF-001 part)
- C9 Role permissions and step needs: R1-13, R3-08
- C10 CONFLICT, agency users and tenants: R3-06 says an agency person works inside a client tenant (sees the client's theme); R2-03 says agency staff never switch into a client tenant and see client permits from their own agency tenant. Pick one and say why.
- C11 Emergency-subset audience and timing: R1-14 vs D7 and R2-08 (FR-PRV-005 split)

Write your votes to votes-<your reviewer number>.md in this directory, in exactly this format:

```
R1-01: agree | <optional one-line amendment>
R2-03: disagree | <reason>
...
C1: <R1-05 | R3-01 | merge> | <must keep>
...
C10: <R3-06 | R2-03> | <why>
```

Reply with only the file path when done.
