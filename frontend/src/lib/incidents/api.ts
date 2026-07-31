import { ApiError, fetchApi, getApiBaseUrl } from "@/lib/api";
import type {
  ArchivedIncident,
  AssignInvestigationPayload,
  CloseIncidentPayload,
  CorrectiveAction,
  CorrectiveActionPayload,
  CreateIncidentPayload,
  Incident,
  IncidentDetail,
  IncidentEvidence,
  IncidentHistoryResponse,
  InvestigationDetail,
  PreventiveActionPayload,
  RootCausePayload,
  VerifyIncidentPayload,
} from "./types";

export function listIncidents() {
  return fetchApi<Incident[]>("/incidents");
}

export function getIncident(id: string) {
  return fetchApi<IncidentDetail>(`/incidents/${id}`);
}

export function createIncident(payload: CreateIncidentPayload) {
  return fetchApi<Incident>("/incidents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitIncident(id: string) {
  return fetchApi<Incident>(`/incidents/${id}/submit`, { method: "POST" });
}

export function listIncidentEvidence(id: string) {
  return fetchApi<IncidentEvidence[]>(`/incidents/${id}/evidence`);
}

export async function uploadIncidentEvidence(id: string, file: File, comment?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (comment) {
    formData.append("comment", comment);
  }

  const token =
    typeof window !== "undefined" ? localStorage.getItem("ptw_access_token") : null;

  const response = await fetch(`${getApiBaseUrl()}/incidents/${id}/evidence`, {
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

  return body.data as IncidentEvidence;
}

export function assignInvestigation(incidentId: string, payload: AssignInvestigationPayload) {
  return fetchApi(`/incidents/${incidentId}/assign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordRootCause(incidentId: string, payload: RootCausePayload) {
  return fetchApi(`/incidents/${incidentId}/root-cause`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createCorrectiveAction(incidentId: string, payload: CorrectiveActionPayload) {
  return fetchApi(`/incidents/${incidentId}/corrective-actions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createPreventiveAction(incidentId: string, payload: PreventiveActionPayload) {
  return fetchApi(`/incidents/${incidentId}/preventive-actions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getInvestigation(incidentId: string) {
  return fetchApi<InvestigationDetail>(`/incidents/${incidentId}/investigation`);
}

export function updateCorrectiveAction(
  actionId: string,
  payload: { status?: string; description?: string; dueDate?: string },
) {
  return fetchApi<CorrectiveAction>(`/corrective-actions/${actionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function verifyIncident(incidentId: string, payload: VerifyIncidentPayload) {
  return fetchApi(`/incidents/${incidentId}/verify`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function closeIncident(incidentId: string, payload: CloseIncidentPayload = {}) {
  return fetchApi(`/incidents/${incidentId}/close`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listIncidentArchive(params?: { reference?: string; incidentType?: string }) {
  const search = new URLSearchParams();
  if (params?.reference) search.set("reference", params.reference);
  if (params?.incidentType) search.set("incidentType", params.incidentType);
  const query = search.toString();
  return fetchApi<ArchivedIncident[]>(`/incidents/archive${query ? `?${query}` : ""}`);
}

export function getIncidentHistory(incidentId: string) {
  return fetchApi<IncidentHistoryResponse>(`/incidents/${incidentId}/history`);
}
