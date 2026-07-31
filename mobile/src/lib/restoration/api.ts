import { fetchApi } from "@/lib/api/client";
import type { IsolationExecution } from "@/lib/isolation-execution/types";
import type {
  LockRemoval,
  LototoHistoryEntry,
  RestorationDetail,
  RestoreEquipmentPayload,
  TagRemoval,
} from "./types";

export function getRestoration(executionId: string) {
  return fetchApi<RestorationDetail>(`/isolation-executions/${executionId}/restoration`);
}

export function removeLock(executionId: string, appliedLockId: string, reason?: string) {
  return fetchApi<LockRemoval>(`/isolation-executions/${executionId}/restoration/locks/remove`, {
    method: "POST",
    body: JSON.stringify({ appliedLockId, reason }),
  });
}

export function removeTag(executionId: string, appliedTagId: string, reason?: string) {
  return fetchApi<TagRemoval>(`/isolation-executions/${executionId}/restoration/tags/remove`, {
    method: "POST",
    body: JSON.stringify({ appliedTagId, reason }),
  });
}

export function restoreEquipment(executionId: string, payload: RestoreEquipmentPayload) {
  return fetchApi<unknown>(`/isolation-executions/${executionId}/restoration/equipment`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeRestoration(executionId: string) {
  return fetchApi<IsolationExecution>(
    `/isolation-executions/${executionId}/restoration/complete`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export function getExecutionHistory(executionId: string) {
  return fetchApi<LototoHistoryEntry[]>(`/isolation-executions/${executionId}/history`);
}

export function getPlanHistory(planId: string) {
  return fetchApi<LototoHistoryEntry[]>(`/lototo-plans/${planId}/history`);
}
