import { ApiError } from "@/lib/api";
import { fetchApi, getApiBaseUrl } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/token-storage";
import type { ExecutionDetail } from "./types";

export function getExecution(permitId: string) {
  return fetchApi<ExecutionDetail>(`/permits/${permitId}/execution`);
}

export function activatePermit(permitId: string) {
  return fetchApi<ExecutionDetail>(`/permits/${permitId}/activate`, {
    method: "POST",
    body: JSON.stringify({ readinessConfirmed: true }),
  });
}

export function addProgress(permitId: string, summary: string) {
  return fetchApi(`/permits/${permitId}/progress`, {
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

export async function uploadEvidence(
  permitId: string,
  file: { uri: string; name: string; mimeType: string },
  comment?: string,
) {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
  if (comment) formData.append("comment", comment);

  const token = await getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}/permits/${permitId}/evidence`, {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new ApiError(body.error?.message ?? "Evidence upload failed");
  }
  return body.data;
}
