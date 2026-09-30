import { fetchApi, getApiBaseUrl } from "@/lib/api/client";
import { ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth/token-storage";
import type { CreatePermitPayload, PermitDetail, PermitLototoExecutionBoard, PermitRecord, SaveDraftPayload } from "./types";

export function listPermits(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchApi<PermitRecord[]>(`/permits${query}`);
}

export function getPermit(id: string) {
  return fetchApi<PermitDetail>(`/permits/${id}`);
}

export function getPermitLototoExecution(permitId: string) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/execution`);
}

export function recordPermitLototoCrew(
  permitId: string,
  instanceId: string,
  payload: { basePointId?: string; extraPointId?: string; lockTagId: string },
) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/instances/${instanceId}/crew`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordPermitLototoVerify(
  permitId: string,
  instanceId: string,
  payload: { basePointId?: string; extraPointId?: string; result: "pass" | "fail"; tryOutCompleted: boolean },
) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/instances/${instanceId}/verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordPermitLototoRestore(
  permitId: string,
  instanceId: string,
  payload: { basePointId?: string; extraPointId?: string; lockTagId: string },
) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/instances/${instanceId}/restore`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordPermitLototoRestoreVerify(
  permitId: string,
  instanceId: string,
  payload: { basePointId?: string; extraPointId?: string; result: "pass" | "fail" },
) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/instances/${instanceId}/restore-verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

export async function uploadPermitAttachment(
  permitId: string,
  file: { uri: string; name: string; mimeType: string },
) {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  const token = await getAccessToken();
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
