import { fetchApi } from "@/lib/api";
import type {
  AlertListItem,
  AnalyseResult,
  ApproveConflictPayload,
  AssessConflictPayload,
  ConflictAssessment,
  ConflictDetail,
  ConflictResolution,
  ConflictSeverity,
  ConflictStatus,
  HistoryListItem,
  MitigationPlan,
  MitigationPlanPayload,
  RejectConflictPayload,
  SimopsConflict,
} from "./types";

export function listSimopsConflicts(params?: {
  status?: ConflictStatus;
  severity?: ConflictSeverity;
  permitId?: string;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.severity) search.set("severity", params.severity);
  if (params?.permitId) search.set("permitId", params.permitId);
  const query = search.toString();
  return fetchApi<SimopsConflict[]>(`/simops/conflicts${query ? `?${query}` : ""}`);
}

export function getSimopsConflict(conflictId: string) {
  return fetchApi<ConflictDetail>(`/simops/conflicts/${conflictId}`);
}

export function analyseSimopsConflicts(permitId?: string) {
  return fetchApi<AnalyseResult>("/simops/analyse", {
    method: "POST",
    body: JSON.stringify(permitId ? { permitId } : {}),
  });
}

export function listSimopsAlerts() {
  return fetchApi<AlertListItem[]>("/simops/alerts");
}

export function assessSimopsConflict(conflictId: string, payload: AssessConflictPayload) {
  return fetchApi<ConflictAssessment>(`/simops/conflicts/${conflictId}/assess`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createMitigationPlan(conflictId: string, payload: MitigationPlanPayload) {
  return fetchApi<MitigationPlan>(`/simops/conflicts/${conflictId}/mitigation`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function approveSimopsConflict(conflictId: string, payload: ApproveConflictPayload) {
  return fetchApi<ConflictResolution>(`/simops/conflicts/${conflictId}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rejectSimopsConflict(conflictId: string, payload: RejectConflictPayload) {
  return fetchApi<ConflictResolution>(`/simops/conflicts/${conflictId}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function acknowledgeLowSimopsConflict(conflictId: string, comments: string) {
  return fetchApi<ConflictResolution>(`/simops/conflicts/${conflictId}/acknowledge-low`, {
    method: "POST",
    body: JSON.stringify({ comments }),
  });
}

export function acknowledgeDepartmentSimopsConflict(conflictId: string) {
  return fetchApi<SimopsConflict>(`/simops/conflicts/${conflictId}/acknowledge-department`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function listSimopsHistory() {
  return fetchApi<HistoryListItem[]>("/simops/history");
}

export function getSimopsHistoryRecord(conflictId: string) {
  return fetchApi<ConflictDetail>(`/simops/history/${conflictId}`);
}
