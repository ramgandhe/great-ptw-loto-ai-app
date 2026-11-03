import { ApiError, fetchApi, getApiBaseUrl } from "@/lib/api";
import { getAccessToken, clearTokens } from "@/lib/auth/token-storage";
import { refreshAccessToken } from "@/lib/auth/session";
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

export type LototoImportFieldError = {
  sheet: string;
  row?: number;
  field: string;
  message: string;
  code: string;
};

export type LototoImportOverrideDetails = {
  confirmOverrideRequired: true;
  procedureId: string;
  code: string;
  status: string;
  title: string;
  hasDraft: boolean;
};

export async function downloadLototoProcedureTemplate() {
  const token = getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}/lototo/procedures/import/template`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401 && typeof window !== "undefined") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return downloadLototoProcedureTemplate();
    }
    clearTokens();
    window.location.assign(`/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
    throw new ApiError("Session expired. Redirecting to sign in…", "Unauthorized");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error?.message ?? "Template download failed", body?.error?.code, body?.error?.details);
  }
  const blob = await response.blob();
  const fromCustom = response.headers.get("X-Template-Filename");
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)"?/i.exec(disposition);
  const fileName =
    fromCustom ||
    (match?.[1] ? decodeURIComponent(match[1]) : null) ||
    "permitwiseai_lototo_procedure_template.xlsx";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function importLototoProcedure(file: File, options?: { confirmOverride?: boolean }) {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.confirmOverride) {
    formData.append("confirmOverride", "true");
  }
  return fetchApi<LototoProcedure>("/lototo/procedures/import", {
    method: "POST",
    body: formData,
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

export function recordLototoProcedureInspection(
  procedureId: string,
  payload: {
    result: "pass" | "needs_revision";
    employeesObserved?: string;
    notes?: string;
    nextDueOn?: string;
  },
) {
  return fetchApi<LototoProcedure>(`/lototo/procedures/${procedureId}/inspections`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
