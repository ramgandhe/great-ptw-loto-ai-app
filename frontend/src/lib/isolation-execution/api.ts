import { ApiError, fetchApi } from "@/lib/api";
import type {
  AppliedLock,
  AppliedTag,
  ApplyLockPayload,
  ApplyTagPayload,
  EvidenceUploadUrlResult,
  IsolationEvidence,
  IsolationExecution,
  IsolationExecutionDetail,
  IsolationVerification,
  RecordVerificationPayload,
} from "./types";

export function startIsolationExecution(planId: string) {
  return fetchApi<IsolationExecution>(`/lototo-plans/${planId}/isolation-execution`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getIsolationExecutionForPlan(planId: string) {
  return fetchApi<IsolationExecutionDetail>(`/lototo-plans/${planId}/isolation-execution`);
}

export function getIsolationExecutionDetail(executionId: string) {
  return fetchApi<IsolationExecutionDetail>(`/isolation-executions/${executionId}`);
}

export function markIsolationComplete(executionId: string) {
  return fetchApi<IsolationExecution>(`/isolation-executions/${executionId}/isolate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function markIsolationVerified(executionId: string) {
  return fetchApi<IsolationExecution>(`/isolation-executions/${executionId}/verify`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function applyLock(executionId: string, payload: ApplyLockPayload) {
  return fetchApi<AppliedLock>(`/isolation-executions/${executionId}/locks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listLocks(executionId: string) {
  return fetchApi<AppliedLock[]>(`/isolation-executions/${executionId}/locks`);
}

export function applyTag(executionId: string, payload: ApplyTagPayload) {
  return fetchApi<AppliedTag>(`/isolation-executions/${executionId}/tags`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listTags(executionId: string) {
  return fetchApi<AppliedTag[]>(`/isolation-executions/${executionId}/tags`);
}

export function recordVerification(executionId: string, payload: RecordVerificationPayload) {
  return fetchApi<IsolationVerification>(
    `/isolation-executions/${executionId}/verifications`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function listVerifications(executionId: string) {
  return fetchApi<IsolationVerification[]>(
    `/isolation-executions/${executionId}/verifications`,
  );
}

export function getEvidenceUploadUrl(
  executionId: string,
  payload: { fileName: string; contentType: string },
) {
  return fetchApi<EvidenceUploadUrlResult>(
    `/isolation-executions/${executionId}/evidence/upload-url`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function captureIsolationEvidence(
  executionId: string,
  payload: {
    isolationPointId?: string;
    verificationId?: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    storageKey: string;
    checksum?: string;
  },
) {
  return fetchApi<IsolationEvidence>(`/isolation-executions/${executionId}/evidence`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadIsolationEvidence(
  executionId: string,
  file: File,
  options?: { isolationPointId?: string; verificationId?: string },
) {
  const uploadMeta = await getEvidenceUploadUrl(executionId, {
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
  });

  const putResponse = await fetch(uploadMeta.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });

  if (!putResponse.ok) {
    throw new ApiError("Evidence file upload failed");
  }

  return captureIsolationEvidence(executionId, {
    isolationPointId: options?.isolationPointId,
    verificationId: options?.verificationId,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    fileSize: file.size,
    storageKey: uploadMeta.storageKey,
  });
}
