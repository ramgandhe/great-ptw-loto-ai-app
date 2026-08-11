import { fetchApi } from "@/lib/api";
import type {
  AssignInvestigationPayload,
  CloseIncidentPayload,
  CorrectiveActionPayload,
  CreateIncidentPayload,
  Incident,
  IncidentDetail,
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

export function continueNearMiss(id: string, comments?: string) {
  return fetchApi(`/incidents/${id}/severity/continue`, {
    method: "POST",
    body: JSON.stringify({ comments }),
  });
}

export function stopNearMiss(id: string, comments?: string) {
  return fetchApi(`/incidents/${id}/severity/stop`, {
    method: "POST",
    body: JSON.stringify({ comments }),
  });
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
