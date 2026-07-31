import { fetchApi } from "@/lib/api";
import type { MachineryRecord, NotificationPreference, Organisation, OrgRecord } from "./types";

function crud<T extends OrgRecord>(basePath: string) {
  return {
    list: () => fetchApi<T[]>(basePath),
    get: (id: string) => fetchApi<T>(`${basePath}/${id}`),
    create: (payload: Partial<T>) =>
      fetchApi<T>(basePath, { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<T>) =>
      fetchApi<T>(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    archive: (id: string) => fetchApi<void>(`${basePath}/${id}`, { method: "DELETE" }),
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
  archive: (id: string) => fetchApi<void>(`/organisations/${id}`, { method: "DELETE" }),
};

export const plantsApi = crud<OrgRecord>("/plants");
export const departmentsApi = crud<OrgRecord>("/departments");
export const locationsApi = crud<OrgRecord>("/locations");
export const workstationsApi = crud<OrgRecord>("/workstations");
export const machineryApi = {
  ...crud<MachineryRecord>("/machinery"),
  list: () => fetchApi<MachineryRecord[]>("/machinery"),
};
export const approvalWorkflowsApi = crud<OrgRecord>("/approval-workflows");
export const permitTemplatesApi = crud<OrgRecord>("/permit-templates");
export const safetyChecklistsApi = crud<OrgRecord>("/safety-checklists");
export const ppeConfigurationsApi = crud<OrgRecord>("/ppe-configurations");
export const notificationPreferencesApi = crud<NotificationPreference>("/notification-preferences");
