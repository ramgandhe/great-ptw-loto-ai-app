import { getAccessToken } from "@/lib/auth/token-storage";
import { ApiError, fetchApi, getApiBaseUrl } from "@/lib/api/client";
import type {
  EvidenceRecord,
  ExecutionActionResult,
  ProgressRecord,
} from "./types";
import {
  listPendingEvidence,
  listPendingProgress,
  removePendingEvidence,
  removePendingProgress,
} from "./offline";

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

export async function uploadEvidence(
  permitId: string,
  file: { uri: string; name: string; type: string },
  options?: { comment?: string; progressId?: string },
) {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  if (options?.comment) {
    formData.append("comment", options.comment);
  }
  if (options?.progressId) {
    formData.append("progressId", options.progressId);
  }

  const token = await getAccessToken();

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

export async function syncExecutionQueue(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  for (const item of await listPendingProgress()) {
    try {
      await addProgress(item.permitId, { summary: item.summary });
      await removePendingProgress(item.id);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  for (const item of await listPendingEvidence()) {
    try {
      await uploadEvidence(
        item.permitId,
        { uri: item.uri, name: item.fileName, type: item.contentType },
        { comment: item.comment },
      );
      await removePendingEvidence(item.id);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}
