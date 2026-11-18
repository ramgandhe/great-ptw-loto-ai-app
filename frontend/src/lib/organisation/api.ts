import { ApiError, fetchApi, getApiBaseUrl } from "@/lib/api";
import { refreshAccessToken } from "@/lib/auth/session";
import { clearTokens, getAccessToken } from "@/lib/auth/token-storage";
import { forceQuery } from "@/lib/confirm-delete";
import type { HazardRecord } from "@/lib/master-data/api";
import type { MachineryRecord, NotificationPreference, Organisation, OrgRecord } from "./types";

function crud<T extends { id: string }>(basePath: string) {
  return {
    list: () => fetchApi<T[]>(basePath),
    /** Archived records (plants, departments, locations, workflows). */
    listArchived: () => fetchApi<T[]>(`${basePath}?archived=true`),
    get: (id: string) => fetchApi<T>(`${basePath}/${id}`),
    create: (payload: Partial<T>) =>
      fetchApi<T>(basePath, { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<T>) =>
      fetchApi<T>(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    archive: (id: string, force = false) =>
      fetchApi<void>(`${basePath}/${id}${forceQuery(force)}`, { method: "DELETE" }),
  };
}

export const organisationsApi = {
  list: () => fetchApi<Organisation[]>("/organisations"),
  get: (id: string) => fetchApi<Organisation>(`/organisations/${id}`),
  create: (payload: Partial<Organisation>) =>
    fetchApi<Organisation>("/organisations", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<Organisation>) =>
    fetchApi<Organisation>(`/organisations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  archive: (id: string, force = false) =>
    fetchApi<void>(`/organisations/${id}${forceQuery(force)}`, { method: "DELETE" }),
  uploadLogo: (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return fetchApi<Organisation>(`/organisations/${id}/logo`, { method: "POST", body });
  },
  removeLogo: (id: string) => fetchApi<Organisation>(`/organisations/${id}/logo`, { method: "DELETE" }),
  logo: (id: string) => fetchOrganisationLogo(id),
};

async function fetchOrganisationLogo(id: string, retried = false): Promise<Blob> {
  const token = getAccessToken();
  const response = await fetch(`${getApiBaseUrl()}/organisations/${id}/logo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401 && !retried && typeof window !== "undefined") {
    const refreshed = await refreshAccessToken();
    if (refreshed) return fetchOrganisationLogo(id, true);
    clearTokens();
    window.location.assign(`/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
    throw new ApiError("Session expired. Redirecting to sign in…", "Unauthorized");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error?.message ?? "Logo could not be loaded", body?.error?.code);
  }
  return response.blob();
}

export const plantsApi = crud<OrgRecord>("/plants");
export const sitesApi = {
  ...crud<OrgRecord>("/sites"),
  archive: async (id: string, _force = false) => {
    await fetchApi<OrgRecord>(`/sites/${id}/archive`, { method: "POST" });
  },
};
export const departmentsApi = crud<OrgRecord>("/departments");
export const locationsApi = crud<OrgRecord>("/locations");
export const workstationsApi = crud<OrgRecord>("/workstations");
export const machineryApi = {
  ...crud<MachineryRecord>("/machinery"),
  list: () => fetchApi<MachineryRecord[]>("/machinery"),
};
export const approvalWorkflowsApi = {
  ...crud<OrgRecord>("/approval-workflows"),
  activate: (id: string) =>
    fetchApi<OrgRecord>(`/approval-workflows/${id}/activate`, { method: "POST" }),
};
export const safetyChecklistsApi = crud<OrgRecord>("/safety-checklists");
export const ppeConfigurationsApi = crud<OrgRecord>("/ppe-configurations");
export const hazardsApi = crud<HazardRecord>("/hazards");

export type HazardCatalogueRequest = {
  id: string;
  permitId: string;
  permitTitle: string;
  permitReference: string | null;
  name: string;
  description: string | null;
  risks: string[];
  consequences: string[];
  controls: string[];
  permitTypeCode: string | null;
  siteId: string | null;
  workLocationId: string | null;
  workLocationName: string | null;
  assets: Array<{ id: string; name: string }>;
  requestedByName: string | null;
  createdAt: string;
};

export const hazardRequestsApi = {
  list: () => fetchApi<HazardCatalogueRequest[]>("/hazards/catalogue-requests"),
  approve: (
    id: string,
    payload: {
      name: string;
      description?: string;
      risks: string[];
      consequences: string[];
      controls: string[];
      permitTypeCodes: string[];
      workLocationIds: string[];
      assetIds: string[];
    },
  ) => fetchApi<{ id: string; status: string }>(`/hazards/catalogue-requests/${id}/approve`, { method: "POST", body: JSON.stringify(payload) }),
  reject: (id: string) => fetchApi<{ id: string; status: string }>(`/hazards/catalogue-requests/${id}/reject`, { method: "POST" }),
};
export const notificationPreferencesApi = crud<NotificationPreference>("/notification-preferences");
