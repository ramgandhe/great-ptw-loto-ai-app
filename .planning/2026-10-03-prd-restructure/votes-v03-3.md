VC-1: agree
VC-2: agree-with-amendment | Append to the new FR-PTW-012: "For an action recorded offline, the end time is compared with the action's device time (NFR-OFF-001, FR-CRW-010), not its receipt time."
VC-3: agree-with-amendment | Rename the list "Received after access ended" in FR-AGY-008 and in path (d). Path (d) also covers a finished wind-down and a handover, so the name "Received after End now" would be wrong in those cases.

Contradictions:
- VC-2 as written ("checking the end time on every such action") can be read as checking against server receipt time. That contradicts NFR-OFF-001, which judges offline actions by their device time, so progress or a check-in recorded offline at 11:50 and synced at 12:30 would be refused for a noon end time. The VC-2 amendment resolves this.
