import { fetchApi } from "@/lib/api";
import type {
  CreateShiftHandoverPayload,
  DailyActivityEvent,
  DailyProgressRecord,
  RecordDailyProgressPayload,
  RequestExtensionPayload,
  RevalidatePermitPayload,
  RevalidationHistoryEvent,
  ShiftHandoverRecord,
} from "./types";

export function listDailyProgress(permitId: string) {
  return fetchApi<DailyProgressRecord[]>(`/permits/${permitId}/daily-progress`);
}

export function recordDailyProgress(permitId: string, payload: RecordDailyProgressPayload) {
  return fetchApi<DailyProgressRecord>(`/permits/${permitId}/daily-progress`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listHandovers(permitId: string) {
  return fetchApi<ShiftHandoverRecord[]>(`/permits/${permitId}/handover`);
}

export function createHandover(permitId: string, payload: CreateShiftHandoverPayload) {
  return fetchApi<ShiftHandoverRecord>(`/permits/${permitId}/handover`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listDailyActivityHistory(permitId: string) {
  return fetchApi<DailyActivityEvent[]>(`/permits/${permitId}/daily-history`);
}

export function revalidatePermit(permitId: string, payload: RevalidatePermitPayload) {
  return fetchApi(`/permits/${permitId}/revalidate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function continuePermit(permitId: string) {
  return fetchApi(`/permits/${permitId}/continue`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function suspendPermitForRevalidation(permitId: string, reason: string) {
  return fetchApi(`/permits/${permitId}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function requestExtension(permitId: string, payload: RequestExtensionPayload) {
  return fetchApi(`/permits/${permitId}/extensions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createRenewal(permitId: string) {
  return fetchApi(`/permits/${permitId}/renewals`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function submitRenewal(renewalId: string) {
  return fetchApi(`/renewals/${renewalId}/submit`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function listRevalidationHistory(permitId: string) {
  return fetchApi<RevalidationHistoryEvent[]>(`/permits/${permitId}/revalidation-history`);
}
