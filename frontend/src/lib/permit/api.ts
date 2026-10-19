import { ApiError, fetchApi } from "@/lib/api";
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

export function submitPermit(id: string, expectedRevision: number) {
  return fetchApi<PermitDetail>(`/permits/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ expectedRevision }),
  });
}

export function handoffPermitDraft(id: string, payload: { to: string; expectedRevision: number }) {
  return fetchApi<PermitDetail>(`/permits/${id}/handoff`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function returnPermitDraft(id: string, expectedRevision: number, reason: string) {
  return fetchApi<PermitDetail>(`/permits/${id}/return-draft`, {
    method: "POST",
    body: JSON.stringify({ expectedRevision, reason }),
  });
}

export function getPermitLototoExecution(permitId: string) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/execution`);
}

export function tickPermitLototoSequenceStep(
  permitId: string,
  instanceId: string,
  payload: { sequenceStepId: string; note?: string; file?: File | null },
) {
  const formData = new FormData();
  formData.append("sequenceStepId", payload.sequenceStepId);
  if (payload.note) {
    formData.append("note", payload.note);
  }
  if (payload.file) {
    formData.append("file", payload.file);
  }
  return fetchApi<PermitLototoExecutionBoard>(
    `/permits/${permitId}/lototo/instances/${instanceId}/sequence-ticks`,
    { method: "POST", body: formData },
  );
}

export function confirmPermitLototoPhase(
  permitId: string,
  instanceId: string,
  payload: {
    phase: "apply" | "remove";
    result: "pass" | "fail";
    tryOutCompleted: boolean;
    signedName: string;
    lockTagId?: string;
    reading?: string;
    note?: string;
    file?: File | null;
  },
) {
  const formData = new FormData();
  formData.append("phase", payload.phase);
  formData.append("result", payload.result);
  formData.append("tryOutCompleted", payload.tryOutCompleted ? "true" : "false");
  formData.append("signedName", payload.signedName);
  if (payload.lockTagId) {
    formData.append("lockTagId", payload.lockTagId);
  }
  if (payload.reading) {
    formData.append("reading", payload.reading);
  }
  if (payload.note) {
    formData.append("note", payload.note);
  }
  if (payload.file) {
    formData.append("file", payload.file);
  }
  return fetchApi<PermitLototoExecutionBoard>(
    `/permits/${permitId}/lototo/instances/${instanceId}/phase-confirm`,
    { method: "POST", body: formData },
  );
}

export function restartPermitLototoVerification(
  permitId: string,
  instanceId: string,
  phase: "apply" | "remove",
) {
  return fetchApi<PermitLototoExecutionBoard>(
    `/permits/${permitId}/lototo/instances/${instanceId}/restart-verification`,
    { method: "POST", body: JSON.stringify({ phase }) },
  );
}

export function startPermitLototo(
  permitId: string,
  instanceId: string,
) {
  return fetchApi<PermitLototoExecutionBoard>(`/permits/${permitId}/lototo/instances/${instanceId}/start`, {
    method: "POST",
  });
}

export function declarePermitLototoCrewComplete(permitId: string, instanceId: string) {
  return fetchApi<PermitLototoExecutionBoard>(
    `/permits/${permitId}/lototo/instances/${instanceId}/crew-complete`,
    { method: "POST" },
  );
}

export function recordPermitLototoCrew(
  permitId: string,
  instanceId: string,
  payload: {
    basePointId?: string;
    extraPointId?: string;
    lockTagId?: string;
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
  payload: { basePointId?: string; extraPointId?: string; lockTagId?: string; comment?: string },
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

/** The server refused a save or submit because the permit changed since it was loaded. */
export function isRevisionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === "PERMIT_REVISION_CONFLICT";
}

export function deleteDraftPermit(id: string) {
  return fetchApi<{ id: string; deleted: boolean }>(`/permits/${id}`, {
    method: "DELETE",
  });
}

/** Temporary owner cleanup. Removes the permit and incidents linked to it. */
export function purgePermit(id: string) {
  return fetchApi<{ id: string; deleted: boolean }>(`/permits/${id}/purge`, {
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
