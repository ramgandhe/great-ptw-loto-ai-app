import { fetchApi } from "@/lib/api/client";
import type {
  AssessConflictPayload,
  ConflictDetail,
  ConflictResolution,
  MitigationPlanPayload,
  SimopsConflict,
} from "./types";

export function listSimopsConflicts() {
  return fetchApi<SimopsConflict[]>("/simops/conflicts");
}

export function getSimopsConflict(conflictId: string) {
  return fetchApi<ConflictDetail>(`/simops/conflicts/${conflictId}`);
}

export function assessSimopsConflict(conflictId: string, payload: AssessConflictPayload) {
  return fetchApi(`/simops/conflicts/${conflictId}/assess`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createMitigationPlan(conflictId: string, payload: MitigationPlanPayload) {
  return fetchApi(`/simops/conflicts/${conflictId}/mitigation`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function approveSimopsConflict(conflictId: string, comments: string) {
  return fetchApi<ConflictResolution>(`/simops/conflicts/${conflictId}/approve`, {
    method: "POST",
    body: JSON.stringify({ comments }),
  });
}

export function rejectSimopsConflict(conflictId: string, reason: string) {
  return fetchApi<ConflictResolution>(`/simops/conflicts/${conflictId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
