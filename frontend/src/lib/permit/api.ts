import { fetchApi } from "@/lib/api";
import type { CreatePermitPayload, PermitDetail, PermitLototoExecutionBoard, PermitRecord, SaveDraftPayload } from "./types";

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

export function getPermitLototoExecution(permitId: string) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/execution`);
}

export function recordPermitLototoCrew(
  permitId: string,
  instanceId: string,
  payload: {
    basePointId?: string;
    extraPointId?: string;
    lockTagId: string;
    reading?: string;
    comment?: string;
  },
) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/instances/${instanceId}/crew`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function reassignPermitPeople(
  id: string,
  payload: {
    executors?: Array<{ workforceUserId: string; isPrimary?: boolean }>;
    lototo?: Array<{
      procedureId: string;
      crew: Array<{ workforceUserId: string }>;
      verifiers: Array<{ workforceUserId: string }>;
    }>;
  },
) {
  return fetchApi<PermitDetail>(`/permits/${id}/reassign-people`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordPermitLototoVerify(
  permitId: string,
  instanceId: string,
  payload: {
    basePointId?: string;
    extraPointId?: string;
    result: "pass" | "fail";
    tryOutCompleted: boolean;
    reading?: string;
    comment?: string;
  },
) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/instances/${instanceId}/verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordPermitLototoRestore(
  permitId: string,
  instanceId: string,
  payload: { basePointId?: string; extraPointId?: string; lockTagId: string; comment?: string },
) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/instances/${instanceId}/restore`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordPermitLototoRestoreVerify(
  permitId: string,
  instanceId: string,
  payload: { basePointId?: string; extraPointId?: string; result: "pass" | "fail"; comment?: string },
) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/instances/${instanceId}/restore-verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
