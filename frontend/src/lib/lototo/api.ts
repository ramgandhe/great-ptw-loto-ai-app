import { fetchApi } from "@/lib/api";
import { forceQuery } from "@/lib/confirm-delete";
import type {
  AddIsolationPointPayload,
  AssignPersonnelPayload,
  ConfigureSequencePayload,
  CreateLototoPlanPayload,
  IsolationPoint,
  LototoAssignment,
  LototoPlan,
  LototoPlanDetail,
  LototoProcedure,
  LototoProcedureListItem,
  LototoProcedurePayload,
  LototoProcedureVersion,
} from "./types";

export function listLototoPlans(filters?: { permitId?: string; machineryId?: string }) {
  const params = new URLSearchParams();
  if (filters?.permitId) params.set("permitId", filters.permitId);
  if (filters?.machineryId) params.set("machineryId", filters.machineryId);
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchApi<LototoPlan[]>(`/lototo/plans${query}`);
}

export function getLototoPlan(planId: string) {
  return fetchApi<LototoPlanDetail>(`/lototo/plans/${planId}`);
}

export function createLototoPlan(payload: CreateLototoPlanPayload) {
  return fetchApi<LototoPlan>("/lototo/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function assignLototoPersonnel(planId: string, payload: AssignPersonnelPayload) {
  return fetchApi<LototoAssignment>(`/lototo/plans/${planId}/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addIsolationPoint(planId: string, payload: AddIsolationPointPayload) {
  return fetchApi<IsolationPoint>(`/lototo/plans/${planId}/isolation-points`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removeIsolationPoint(planId: string, pointId: string) {
  return fetchApi<{ removed: string }>(`/lototo/plans/${planId}/isolation-points/${pointId}`, { method: "DELETE" });
}

export function configureIsolationSequence(planId: string, payload: ConfigureSequencePayload) {
  return fetchApi<{ configured: number } | IsolationPoint[]>(`/lototo/plans/${planId}/sequence`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listLototoProcedures(filters?: { machineryId?: string; assetId?: string; workLocationId?: string; published?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.machineryId) params.set("machineryId", filters.machineryId);
  if (filters?.assetId) params.set("assetId", filters.assetId);
  if (filters?.workLocationId) params.set("workLocationId", filters.workLocationId);
  if (filters?.published) params.set("published", "true");
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchApi<LototoProcedureListItem[]>(`/lototo/procedures${query}`);
}

export function getLototoProcedure(id: string) {
  return fetchApi<LototoProcedure>(`/lototo/procedures/${id}`);
}

export function getLototoProcedureVersion(versionId: string) {
  return fetchApi<LototoProcedureVersion & { procedure: LototoProcedure }>(`/lototo/procedure-versions/${versionId}`);
}

export function createLototoProcedure(payload: LototoProcedurePayload) {
  return fetchApi<LototoProcedure>("/lototo/procedures", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateLototoProcedure(id: string, payload: Partial<LototoProcedurePayload>) {
  return fetchApi<LototoProcedure>(`/lototo/procedures/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function publishLototoProcedure(id: string) {
  return fetchApi<LototoProcedure>(`/lototo/procedures/${id}/publish`, { method: "POST" });
}

export function reviseLototoProcedure(id: string) {
  return fetchApi<LototoProcedure>(`/lototo/procedures/${id}/revisions`, { method: "POST" });
}

export function deactivateLototoProcedure(id: string) {
  return fetchApi<LototoProcedure>(`/lototo/procedures/${id}/deactivate`, { method: "POST" });
}

export function reactivateLototoProcedure(id: string) {
  return fetchApi<LototoProcedure>(`/lototo/procedures/${id}/reactivate`, { method: "POST" });
}

export function deleteLototoProcedure(id: string, force = false) {
  return fetchApi<{ id: string; deleted: boolean }>(`/lototo/procedures/${id}${forceQuery(force)}`, {
    method: "DELETE",
  });
}

export function uploadLototoPointPhoto(procedureId: string, pointId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi<LototoProcedure>(`/lototo/procedures/${procedureId}/lockout-points/${pointId}/photo`, {
    method: "POST",
    body: formData,
  });
}

export function uploadLototoStepPhoto(procedureId: string, stepId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi<LototoProcedure>(`/lototo/procedures/${procedureId}/sequence-steps/${stepId}/photo`, {
    method: "POST",
    body: formData,
  });
}

export function removeLototoStepPhoto(procedureId: string, stepId: string) {
  return fetchApi<LototoProcedure>(`/lototo/procedures/${procedureId}/sequence-steps/${stepId}/photo`, {
    method: "DELETE",
  });
}

export function removeLototoPointPhoto(procedureId: string, pointId: string) {
  return fetchApi<LototoProcedure>(`/lototo/procedures/${procedureId}/lockout-points/${pointId}/photo`, {
    method: "DELETE",
  });
}
