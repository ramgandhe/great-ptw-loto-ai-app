import { enqueueSyncItem } from "@/lib/offline/queue";

export async function queueOfflineLockRemoval(
  executionId: string,
  payload: { appliedLockId: string; reason?: string },
): Promise<void> {
  await enqueueSyncItem({
    entityType: "restoration_lock_removal",
    method: "POST",
    path: `/isolation-executions/${executionId}/restoration/locks/remove`,
    payload,
  });
}

export async function queueOfflineTagRemoval(
  executionId: string,
  payload: { appliedTagId: string; reason?: string },
): Promise<void> {
  await enqueueSyncItem({
    entityType: "restoration_tag_removal",
    method: "POST",
    path: `/isolation-executions/${executionId}/restoration/tags/remove`,
    payload,
  });
}

export async function queueOfflineEquipmentRestore(
  executionId: string,
  payload: { isolationPointId: string; method?: string; notes?: string },
): Promise<void> {
  await enqueueSyncItem({
    entityType: "restoration_equipment",
    method: "POST",
    path: `/isolation-executions/${executionId}/restoration/equipment`,
    payload,
  });
}
