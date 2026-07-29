import { ApiError, fetchApi, getApiBaseUrl } from "@/lib/api";
import type { EvidenceRecord, ExecutionDetail, ProgressRecord } from "./types";

export function getPermitExecution(permitId: string) {
  return fetchApi<ExecutionDetail>(`/permits/${permitId}/execution`);
}

export function activatePermit(permitId: string) {
  return fetchApi<ExecutionDetail>(`/permits/${permitId}/activate`, {
    method: "POST",
    body: JSON.stringify({ readinessConfirmed: true }),
  });
}

export function addProgress(permitId: string, summary: string) {
  return fetchApi<ProgressRecord>(`/permits/${permitId}/progress`, {
    method: "POST",
    body: JSON.stringify({ summary }),
  });
}

export function suspendPermit(permitId: string, reason: string) {
  return fetchApi<ExecutionDetail>(`/permits/${permitId}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function resumePermit(permitId: string, reason?: string) {
  return fetchApi<ExecutionDetail>(`/permits/${permitId}/resume`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function uploadExecutionEvidence(
  permitId: string,
  file: File,
  comment?: string,
) {
  const formData = new FormData();
  formData.append("file", file);
  if (comment) formData.append("comment", comment);
  const token =
    typeof window !== "undefined" ? localStorage.getItem("ptw_access_token") : null;
  const response = await fetch(`${getApiBaseUrl()}/permits/${permitId}/evidence`, {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new ApiError(
      body.error?.message ?? "Evidence upload failed",
      body.error?.code,
      body.error?.details,
    );
  }
  return body.data as EvidenceRecord;
}
