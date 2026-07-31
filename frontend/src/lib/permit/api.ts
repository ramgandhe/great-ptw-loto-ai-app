import { ApiError, fetchApi, getApiBaseUrl } from "@/lib/api";
import type { CreatePermitPayload, PermitDetail, PermitRecord, SaveDraftPayload } from "./types";

export function listPermits(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchApi<PermitRecord[]>(`/permits${query}`);
}

export function getPermit(id: string) {
  return fetchApi<PermitDetail>(`/permits/${id}`);
}

export function createPermit(payload: CreatePermitPayload) {
  return fetchApi<PermitDetail>("/permits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function savePermitDraft(id: string, payload: SaveDraftPayload) {
  return fetchApi<PermitDetail>(`/permits/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function submitPermit(id: string) {
  return fetchApi<PermitDetail>(`/permits/${id}/submit`, {
    method: "POST",
  });
}

export async function uploadPermitAttachment(permitId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("ptw_access_token") : null;

  const response = await fetch(`${getApiBaseUrl()}/permits/${permitId}/attachments`, {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new ApiError(
      body.error?.message ?? "Attachment upload failed",
      body.error?.code,
      body.error?.details,
    );
  }

  return body.data as PermitDetail["attachments"][number];
}

export async function removePermitAttachment(permitId: string, attachmentId: string) {
  return fetchApi<void>(`/permits/${permitId}/attachments/${attachmentId}`, {
    method: "DELETE",
  });
}
