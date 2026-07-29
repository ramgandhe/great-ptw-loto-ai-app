import { ApiError, fetchApi, getApiBaseUrl } from "@/lib/api";
import type {
  EvidenceRecord,
  ExecutionActionResult,
  ProgressRecord,
} from "./types";

export function activatePermit(
  permitId: string,
  payload?: { comment?: string; actualStartAt?: string },
) {
  return fetchApi<ExecutionActionResult>(`/permits/${permitId}/activate`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function suspendPermit(permitId: string, reason: string) {
  return fetchApi<ExecutionActionResult>(`/permits/${permitId}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function resumePermit(permitId: string) {
  return fetchApi<ExecutionActionResult>(`/permits/${permitId}/resume`, {
    method: "POST",
  });
}

export function addProgress(
  permitId: string,
  payload: { summary: string; metadata?: Record<string, unknown> },
) {
  return fetchApi<ProgressRecord>(`/permits/${permitId}/progress`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listProgress(permitId: string) {
  return fetchApi<ProgressRecord[]>(`/permits/${permitId}/progress`);
}

export function listEvidence(permitId: string) {
  return fetchApi<EvidenceRecord[]>(`/permits/${permitId}/evidence`);
}

export type DownloadUrlResult = {
  url: string;
  expiresInSeconds: number;
};

export function getEvidenceDownloadUrl(permitId: string, evidenceId: string) {
  return fetchApi<DownloadUrlResult>(`/permits/${permitId}/evidence/${evidenceId}/download-url`);
}

export async function uploadEvidence(
  permitId: string,
  file: File,
  options?: { comment?: string; progressId?: string },
) {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.comment) {
    formData.append("comment", options.comment);
  }
  if (options?.progressId) {
    formData.append("progressId", options.progressId);
  }

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
