import { fetchApi } from "@/lib/api";
import type {
  ArchivedPermitDetail,
  ArchivedPermitSummary,
  ArchiveSearchParams,
  AuditLogEntry,
  ClosePermitResult,
  PermitHistoryEntry,
  PermitVerification,
  VerificationChecklist,
  VerifyPermitResult,
} from "./types";

function buildArchiveQuery(params?: ArchiveSearchParams): string {
  if (!params) {
    return "";
  }
  const search = new URLSearchParams();
  if (params.q) {
    search.set("q", params.q);
  }
  if (params.from) {
    search.set("from", params.from);
  }
  if (params.to) {
    search.set("to", params.to);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getPermitVerification(permitId: string) {
  return fetchApi<PermitVerification | null>(`/permits/${permitId}/verification`);
}

export type DownloadUrlResult = {
  url: string;
  expiresInSeconds: number;
};

export function getArchiveAttachmentDownloadUrl(permitId: string, attachmentId: string) {
  return fetchApi<DownloadUrlResult>(
    `/permits/archive/${permitId}/attachments/${attachmentId}/download-url`,
  );
}

export function verifyPermit(
  permitId: string,
  payload: { comment?: string; checklist: VerificationChecklist },
) {
  return fetchApi<VerifyPermitResult>(`/permits/${permitId}/verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function closePermit(
  permitId: string,
  payload?: { comment?: string; actualEndAt?: string },
) {
  return fetchApi<ClosePermitResult>(`/permits/${permitId}/close`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function listArchivedPermits(params?: ArchiveSearchParams) {
  return fetchApi<ArchivedPermitSummary[]>(`/permits/archive${buildArchiveQuery(params)}`);
}

export function getArchivedPermit(permitId: string) {
  return fetchApi<ArchivedPermitDetail>(`/permits/archive/${permitId}`);
}

export function getPermitHistory(permitId: string) {
  return fetchApi<PermitHistoryEntry[]>(`/permits/${permitId}/history`);
}

export function getPermitAudit(permitId: string) {
  return fetchApi<AuditLogEntry[]>(`/permits/${permitId}/audit`);
}
