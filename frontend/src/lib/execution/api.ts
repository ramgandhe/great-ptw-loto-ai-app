import { fetchApi } from "@/lib/api";
import type {
  EvidenceRecord,
  ExecutionActionResult,
  ProgressRecord,
  WorkCycleSnapshot,
} from "./types";

import type { ExecutionStartState } from "./start";

export function saveExecutionStart(permitId: string, start: ExecutionStartState) {
  return fetchApi<{ executionStart: ExecutionStartState }>(`/permits/${permitId}/execution-start`, {
    method: "POST",
    body: JSON.stringify(start),
  });
}

export function releasePermitForExecution(
  permitId: string,
  payload: { siteReady: boolean; detailsCorrect: boolean },
) {
  return fetchApi<unknown>(`/permits/${permitId}/release-execution`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function activatePermit(
  permitId: string,
  payload?: { comment?: string; actualStartAt?: string; start?: ExecutionStartState },
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

export function getWorkCycle(permitId: string) {
  return fetchApi<WorkCycleSnapshot>(`/permits/${permitId}/work`);
}

export function pauseWork(
  permitId: string,
  payload: {
    summary: string;
    checklist: Record<string, boolean>;
    notes?: string;
    lototoRemovals?: string[];
    overnightRestoreChosen?: boolean;
    lateReason?: string;
  },
) {
  return fetchApi<{
    workUiState: string;
    execution: import("./types").PermitExecution;
    permit: import("@/lib/permit/types").PermitRecord;
  }>(`/permits/${permitId}/work/pause`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resumeWork(
  permitId: string,
  payload: {
    checklist: Record<string, boolean>;
    notes?: string;
    crew?: Array<{ workforceUserId: string; role: "primary" | "substitute" }>;
  },
) {
  return fetchApi<{
    workUiState: string;
    execution: import("./types").PermitExecution;
    permit: import("@/lib/permit/types").PermitRecord;
  }>(`/permits/${permitId}/work/resume`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeExecution(
  permitId: string,
  payload: {
    comment: string;
    checklist: {
      workDescribedComplete: boolean;
      procedureFollowed: boolean;
      lototoDone: boolean;
      gasTestingDone: boolean;
    };
  },
) {
  return fetchApi<import("@/lib/permit/types").PermitDetail>(`/permits/${permitId}/complete-execution`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendBackToExecutor(permitId: string, comment: string) {
  return fetchApi<import("@/lib/permit/types").PermitDetail>(`/permits/${permitId}/send-back-to-executor`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function sendBackToIssuer(permitId: string, comment: string) {
  return fetchApi<import("@/lib/permit/types").PermitDetail>(`/permits/${permitId}/send-back-to-issuer`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function revalidatePermitAfterSuspension(permitId: string) {
  return fetchApi<import("@/lib/permit/types").PermitDetail>(
    `/permits/${permitId}/revalidate-after-suspension`,
    { method: "POST" },
  );
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

  return fetchApi<EvidenceRecord>(`/permits/${permitId}/evidence`, { method: "POST", body: formData });
}
