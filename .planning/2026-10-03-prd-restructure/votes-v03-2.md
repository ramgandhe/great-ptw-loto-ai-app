VC-1: agree
VC-2: agree-with-amendment | Append to the FR-PTW-012 replacement: "For an action recorded offline, the end time is compared with the action's device time (NFR-OFF-001): an action made before the end time and synced after it is accepted, and marked 'Late sync' when FR-CRW-002 applies."
VC-3: agree-with-amendment | In path (d), replace "the sync service, under server authority, appends" with "one SECURITY DEFINER function, which inserts only into that list and checks the assignment in the database, appends". Add: "Evidence files are uploaded only through presigned URLs that this function issues for that submission, with size and type limits (NFR-SEC-010)." Rename the list "Received after access ended" in FR-AGY-008 and in path (d).

Contradictions:
- VC-2 vs NFR-OFF-001: VC-2 has the server refuse check-in and progress from the end time "on every such action", which reads as the time the server receives it. NFR-OFF-001 judges offline actions at their device time. A check-in made offline at 11:50 and synced at 12:30 is refused under one and accepted under the other. Resolved by the VC-2 amendment.
- VC-3 vs NFR-SEC-002 header: "all enforced in the database" does not fit path (d) as written ("the sync service, under server authority"), which is application code, unlike paths (b) and (c). Resolved by the VC-3 amendment.
- VC-3 vs FR-AGY-008: the "Received after End now" list is defined only for End now, while path (d) also fills it when wind-down finishes or the receiver duty is handed over. Resolved by renaming the list in the VC-3 amendment.
