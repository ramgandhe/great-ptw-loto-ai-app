import { ApiError, fetchApi } from "@/lib/api";
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

export function submitPermit(id: string, expectedRevision: number) {
  return fetchApi<PermitDetail>(`/permits/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ expectedRevision }),
  });
}

/** The server refused a save or submit because the permit changed since it was loaded. */
export function isRevisionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === "PERMIT_REVISION_CONFLICT";
}

export function deleteDraftPermit(id: string) {
  return fetchApi<{ id: string; deleted: boolean }>(`/permits/${id}`, {
    method: "DELETE",
  });
}

export async function uploadPermitAttachment(permitId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return fetchApi<PermitDetail["attachments"][number]>(`/permits/${permitId}/attachments`, { method: "POST", body: formData });
}

export async function removePermitAttachment(permitId: string, attachmentId: string) {
  return fetchApi<void>(`/permits/${permitId}/attachments/${attachmentId}`, {
    method: "DELETE",
  });
}
