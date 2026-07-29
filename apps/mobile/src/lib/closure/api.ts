import { fetchApi } from "@/lib/api/client";
import type {
  ArchivedPermitDetail,
  ArchivedPermitSummary,
  ClosePermitResult,
  VerificationChecklist,
  VerifyPermitResult,
} from "./types";
import {
  listPendingVerifications,
  removePendingVerification,
} from "./offline";

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

export function listArchivedPermits(q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return fetchApi<ArchivedPermitSummary[]>(`/permits/archive${query}`);
}

export function getArchivedPermit(permitId: string) {
  return fetchApi<ArchivedPermitDetail>(`/permits/archive/${permitId}`);
}

export async function syncClosureQueue(): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  for (const item of await listPendingVerifications()) {
    try {
      await verifyPermit(item.permitId, {
        checklist: item.checklist,
        comment: item.comment,
      });
      await removePendingVerification(item.id);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}
