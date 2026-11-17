import { fetchApi } from "@/lib/api";
import type {
  CountersignDaySecurePayload,
  CreateDaySecurePayload,
  CreateShiftHandoverPayload,
  DailyActivityEvent,
  DailyProgressRecord,
  DayCycleSnapshot,
  DaySecureChecklistTemplate,
  DaySecureRecord,
  DecideExtensionPayload,
  DecideShiftHandoverPayload,
  PendingTimeRequests,
  PermitExtension,
  PermitOvertimeRequest,
  PermitRevalidation,
  RecordDailyProgressPayload,
  RequestExtensionPayload,
  RequestOvertimePayload,
  ReopenComposition,
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

export function acceptHandover(
  permitId: string,
  handoverId: string,
  payload: DecideShiftHandoverPayload = {},
) {
  return fetchApi<ShiftHandoverRecord>(`/permits/${permitId}/handovers/${handoverId}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rejectHandover(
  permitId: string,
  handoverId: string,
  payload: DecideShiftHandoverPayload = {},
) {
  return fetchApi<ShiftHandoverRecord>(`/permits/${permitId}/handovers/${handoverId}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelHandover(
  permitId: string,
  handoverId: string,
  payload: DecideShiftHandoverPayload = {},
) {
  return fetchApi<ShiftHandoverRecord>(`/permits/${permitId}/handovers/${handoverId}/cancel`, {
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

export type ReopenPermitPayload = {
  outcome: "passed" | "failed";
  findings: string;
  checklist?: Record<string, unknown>;
};

export function reopenPermit(permitId: string, payload: ReopenPermitPayload) {
  return fetchApi(`/permits/${permitId}/reopen`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getReopenComposition(permitId: string) {
  return fetchApi<ReopenComposition>(`/permits/${permitId}/reopen-composition`);
}

export function useMdpOverride(permitId: string, reason: string) {
  return fetchApi(`/permits/${permitId}/mdp-override`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function continuePermit(permitId: string) {
  return fetchApi<{ id: string; status: string; deprecated?: boolean; message?: string }>(
    `/permits/${permitId}/continue`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
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

export function requestOvertime(permitId: string, payload: RequestOvertimePayload) {
  return fetchApi<PermitOvertimeRequest>(`/permits/${permitId}/overtime`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listOvertime(permitId: string) {
  return fetchApi<PermitOvertimeRequest[]>(`/permits/${permitId}/overtime`);
}

export function approveOvertime(overtimeId: string, payload: DecideExtensionPayload = {}) {
  return fetchApi<PermitOvertimeRequest>(`/overtime/${overtimeId}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rejectOvertime(overtimeId: string, payload: DecideExtensionPayload = {}) {
  return fetchApi<PermitOvertimeRequest>(`/overtime/${overtimeId}/reject`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listPendingTimeRequests() {
  return fetchApi<PendingTimeRequests>(`/mdp/pending-time-requests`);
}

export type MorningQueueBucket =
  | "late_secure_required"
  | "reopen_due"
  | "secure_due"
  | "tbt_due"
  | "crew_due"
  | "overtime_pending"
  | "extension_pending"
  | "validity_ending";

export type MorningQueueItem = {
  permitId: string;
  reference: string | null;
  title: string;
  status: string;
  bucket: MorningQueueBucket;
  operationalDate: string | null;
  href: string;
  detail?: string;
};

export type MorningQueueResponse = {
  operationalDate: string;
  timezone: string;
  cutoff: string;
  maxMultiDayValidityDays: number;
  buckets: Record<MorningQueueBucket, MorningQueueItem[]>;
  counts: Record<MorningQueueBucket, number>;
};

export function getMorningQueue() {
  return fetchApi<MorningQueueResponse>(`/mdp/morning-queue`);
}

export function getMdpChecklistLibrary() {
  return fetchApi<{
    seeds: Array<{ code: string; name: string; description: string }>;
    tenantChecklists: Array<{ checklist: { id: string; code: string; name: string; status: string } }>;
  }>(`/mdp/checklist-library`);
}

export function getMdpAnalyticsKpis() {
  return fetchApi<{
    operationalDate: string;
    kpis: Record<string, number | null>;
    queueCounts: Record<string, number>;
  }>(`/mdp/analytics/kpis`);
}

export function listDaySecures(permitId: string) {
  return fetchApi<DaySecureRecord[]>(`/permits/${permitId}/day-secures`);
}

export function getDaySecureChecklistTemplate(permitId: string) {
  return fetchApi<DaySecureChecklistTemplate>(
    `/permits/${permitId}/day-secures/checklist-template`,
  );
}

export function getDayCycle(permitId: string) {
  return fetchApi<DayCycleSnapshot>(`/permits/${permitId}/day-cycle`);
}

export function createDaySecure(permitId: string, payload: CreateDaySecurePayload) {
  return fetchApi<DaySecureRecord>(`/permits/${permitId}/day-secures`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function countersignDaySecure(
  permitId: string,
  secureId: string,
  payload: CountersignDaySecurePayload = {},
) {
  return fetchApi<DaySecureRecord>(
    `/permits/${permitId}/day-secures/${secureId}/countersign`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export type UploadMdpEvidenceOptions = {
  kind: import("./types").MdpEvidenceKind;
  operationalDate?: string;
  dailyProgressId?: string;
  daySecureId?: string;
  revalidationId?: string;
  comment?: string;
};

export function listMdpEvidence(permitId: string, kind?: string) {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return fetchApi<import("./types").MdpEvidenceRecord[]>(
    `/permits/${permitId}/mdp-evidence${query}`,
  );
}

export function getMdpEvidenceDownloadUrl(permitId: string, evidenceId: string) {
  return fetchApi<{ url: string; expiresInSeconds: number }>(
    `/permits/${permitId}/mdp-evidence/${evidenceId}/download-url`,
  );
}

export async function uploadMdpEvidence(
  permitId: string,
  file: File,
  options: UploadMdpEvidenceOptions,
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", options.kind);
  if (options.operationalDate) formData.append("operationalDate", options.operationalDate);
  if (options.dailyProgressId) formData.append("dailyProgressId", options.dailyProgressId);
  if (options.daySecureId) formData.append("daySecureId", options.daySecureId);
  if (options.revalidationId) formData.append("revalidationId", options.revalidationId);
  if (options.comment) formData.append("comment", options.comment);

  return fetchApi<import("./types").MdpEvidenceRecord>(`/permits/${permitId}/mdp-evidence`, {
    method: "POST",
    body: formData,
  });
}

export function getToolboxTalk(permitId: string, operationalDate?: string) {
  const query = operationalDate
    ? `?operationalDate=${encodeURIComponent(operationalDate)}`
    : "";
  return fetchApi<{
    operationalDate: string;
    talk: import("./types").ToolboxTalkRecord | null;
  }>(`/permits/${permitId}/toolbox-talk${query}`);
}

export function recordToolboxTalk(
  permitId: string,
  payload: {
    operationalDate: string;
    topic: string;
    attendeeUserIds?: string[];
    notes?: string;
  },
) {
  return fetchApi<import("./types").ToolboxTalkRecord>(`/permits/${permitId}/toolbox-talk`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listDailyCrew(permitId: string, operationalDate?: string) {
  const query = operationalDate
    ? `?operationalDate=${encodeURIComponent(operationalDate)}`
    : "";
  return fetchApi<{
    operationalDate: string;
    members: import("./types").DailyCrewMember[];
    suggestedFromExecutors: Array<{
      workforceUserId: string;
      role: "primary" | "substitute";
    }>;
  }>(`/permits/${permitId}/daily-crew${query}`);
}

export function replaceDailyCrew(
  permitId: string,
  payload: {
    operationalDate: string;
    members: Array<{
      workforceUserId: string;
      role: "primary" | "substitute";
      substituteForUserId?: string;
      notes?: string;
    }>;
  },
) {
  return fetchApi<{
    operationalDate: string;
    members: import("./types").DailyCrewMember[];
  }>(`/permits/${permitId}/daily-crew`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
