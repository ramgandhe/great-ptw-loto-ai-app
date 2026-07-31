import { fetchApi } from "@/lib/api";
import type {
  CreateShiftHandoverPayload,
  DailyActivityEvent,
  DailyProgressRecord,
  DecideExtensionPayload,
  PermitExtension,
  PermitRevalidation,
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
  return fetchApi<PermitRevalidation>(`/permits/${permitId}/revalidate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function continuePermit(permitId: string) {
  return fetchApi<{ id: string; status: string }>(`/permits/${permitId}/continue`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function suspendPermitForRevalidation(permitId: string, reason: string) {
  return fetchApi<{ id: string; status: string }>(`/permits/${permitId}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function requestExtension(permitId: string, payload: RequestExtensionPayload) {
  return fetchApi<PermitExtension>(`/permits/${permitId}/extensions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listRevalidationHistory(permitId: string) {
  return fetchApi<RevalidationHistoryEvent[]>(`/permits/${permitId}/revalidation-history`);
}

export function approveExtension(extensionId: string, payload: DecideExtensionPayload = {}) {
  return fetchApi<PermitExtension>(`/extensions/${extensionId}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rejectExtension(extensionId: string, payload: DecideExtensionPayload = {}) {
  return fetchApi<PermitExtension>(`/extensions/${extensionId}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
