import { getAccessToken } from "@/lib/auth/token-storage";
import { ApiError, fetchApi, getApiBaseUrl } from "@/lib/api";
import type {
  CreateDaySecurePayload,
  CreateShiftHandoverPayload,
  DailyActivityEvent,
  DailyProgressRecord,
  DayCycleSnapshot,
  DaySecureChecklistTemplate,
  DaySecureRecord,
  DecideShiftHandoverPayload,
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

export function listDailyActivityHistory(permitId: string) {
  return fetchApi<DailyActivityEvent[]>(`/permits/${permitId}/daily-history`);
}

export function revalidatePermit(permitId: string, payload: RevalidatePermitPayload) {
  return fetchApi(`/permits/${permitId}/revalidate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function reopenPermit(
  permitId: string,
  payload: {
    outcome: "passed" | "failed";
    findings: string;
    checklist?: Record<string, unknown>;
  },
) {
  return fetchApi(`/permits/${permitId}/reopen`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getReopenComposition(permitId: string) {
  return fetchApi<import("./types").ReopenComposition>(
    `/permits/${permitId}/reopen-composition`,
  );
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

export function requestOvertime(
  permitId: string,
  payload: { requestedUntil: string; justification: string },
) {
  return fetchApi(`/permits/${permitId}/overtime`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listRevalidationHistory(permitId: string) {
  return fetchApi<RevalidationHistoryEvent[]>(`/permits/${permitId}/revalidation-history`);
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

export function countersignDaySecure(permitId: string, secureId: string) {
  return fetchApi<DaySecureRecord>(
    `/permits/${permitId}/day-secures/${secureId}/countersign`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
}

export type MdpEvidenceKind = "daily_progress" | "day_secure" | "reopen";

export type MdpEvidenceRecord = {
  id: string;
  kind: MdpEvidenceKind;
  fileName: string;
  operationalDate: string | null;
  comment: string | null;
  uploadedAt: string;
};

export function listMdpEvidence(permitId: string, kind?: string) {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return fetchApi<MdpEvidenceRecord[]>(`/permits/${permitId}/mdp-evidence${query}`);
}

export async function uploadMdpEvidence(
  permitId: string,
  file: { uri: string; name: string; type: string },
  options: {
    kind: MdpEvidenceKind;
    dailyProgressId?: string;
    daySecureId?: string;
    revalidationId?: string;
    comment?: string;
  },
) {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  formData.append("kind", options.kind);
  if (options.dailyProgressId) formData.append("dailyProgressId", options.dailyProgressId);
  if (options.daySecureId) formData.append("daySecureId", options.daySecureId);
  if (options.revalidationId) formData.append("revalidationId", options.revalidationId);
  if (options.comment) formData.append("comment", options.comment);

  const token = await getAccessToken();

  const response = await fetch(`${getApiBaseUrl()}/permits/${permitId}/mdp-evidence`, {
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

  return body.data as MdpEvidenceRecord;
}

export function getToolboxTalk(permitId: string, operationalDate?: string) {
  const query = operationalDate
    ? `?operationalDate=${encodeURIComponent(operationalDate)}`
    : "";
  return fetchApi<{
    operationalDate: string;
    talk: {
      id: string;
      topic: string;
      attendeeUserIds: string[];
      notes: string;
    } | null;
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
  return fetchApi(`/permits/${permitId}/toolbox-talk`, {
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
    members: Array<{ id: string; workforceUserId: string; role: string }>;
    suggestedFromExecutors: Array<{ workforceUserId: string; role: "primary" | "substitute" }>;
  }>(`/permits/${permitId}/daily-crew${query}`);
}

export function replaceDailyCrew(
  permitId: string,
  payload: {
    operationalDate: string;
    members: Array<{
      workforceUserId: string;
      role: "primary" | "substitute";
    }>;
  },
) {
  return fetchApi(`/permits/${permitId}/daily-crew`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
