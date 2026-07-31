import { enqueueSyncItem } from "@/lib/offline/queue";
import type { ApplyLockPayload, ApplyTagPayload, RecordVerificationPayload } from "./types";

export async function queueOfflineLock(
  executionId: string,
  payload: ApplyLockPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "isolation_lock",
    method: "POST",
    path: `/isolation-executions/${executionId}/locks`,
    payload,
  });
}

export async function queueOfflineTag(
  executionId: string,
  payload: ApplyTagPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "isolation_tag",
    method: "POST",
    path: `/isolation-executions/${executionId}/tags`,
    payload,
  });
}

export async function queueOfflineVerification(
  executionId: string,
  payload: RecordVerificationPayload,
): Promise<void> {
  await enqueueSyncItem({
    entityType: "isolation_verification",
    method: "POST",
    path: `/isolation-executions/${executionId}/verifications`,
    payload,
  });
}
