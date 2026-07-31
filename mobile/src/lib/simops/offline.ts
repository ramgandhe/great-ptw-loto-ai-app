import { enqueueSyncItem } from "@/lib/offline/queue";
import type { AssessConflictPayload, MitigationPlanPayload } from "./types";

export async function queueOfflineAssess(
  conflictId: string,
  payload: AssessConflictPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "simops_assess",
    method: "POST",
    path: `/simops/conflicts/${conflictId}/assess`,
    payload,
  });
}

export async function queueOfflineMitigation(
  conflictId: string,
  payload: MitigationPlanPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "simops_mitigation",
    method: "POST",
    path: `/simops/conflicts/${conflictId}/mitigation`,
    payload,
  });
}

export async function queueOfflineApprove(conflictId: string, comments: string): Promise<void> {
  await enqueueSyncItem({
    entityType: "simops_approve",
    method: "POST",
    path: `/simops/conflicts/${conflictId}/approve`,
    payload: { comments },
  });
}

export async function queueOfflineReject(conflictId: string, reason: string): Promise<void> {
  await enqueueSyncItem({
    entityType: "simops_reject",
    method: "POST",
    path: `/simops/conflicts/${conflictId}/reject`,
    payload: { reason },
  });
}
