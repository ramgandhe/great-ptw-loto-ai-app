import { fetchApi } from "@/lib/api";
import type { CompetencyRecord, CreatedTenantUser, TenantUser, WorkforceRecord } from "./types";

function crud<T extends { id: string }>(basePath: string) {
  return {
    list: () => fetchApi<T[]>(basePath),
    create: (payload: Partial<T>) =>
      fetchApi<T>(basePath, { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<T>) =>
      fetchApi<T>(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    archive: (id: string) => fetchApi<void>(`${basePath}/${id}`, { method: "DELETE" }),
    deactivate: (id: string) => fetchApi<T>(`${basePath}/${id}/deactivate`, { method: "POST" }),
    reactivate: (id: string) => fetchApi<T>(`${basePath}/${id}/reactivate`, { method: "POST" }),
  };
}

export const employeesApi = crud<WorkforceRecord>("/employees");
export const contractorsApi = crud<WorkforceRecord>("/contractors");
export const agenciesApi = crud<WorkforceRecord>("/agencies");
export const competenciesApi = crud<CompetencyRecord>("/competencies");

export function listTenantUsers() {
  return fetchApi<TenantUser[]>("/tenant-users");
}

export function listPermitExecutors() {
  return fetchApi<TenantUser[]>("/tenant-users/executors");
}

export function listPermitViewers() {
  return fetchApi<TenantUser[]>("/tenant-users/viewers");
}

export function listPermitSafetyOfficers() {
  return fetchApi<TenantUser[]>("/tenant-users/safety-officers");
}

export function listTenantUserNames() {
  return fetchApi<TenantUser[]>("/tenant-users/names");
}

export function updateTenantUser(userId: string, payload: { departmentId?: string }) {
  return fetchApi<TenantUser>(`/tenant-users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createTenantUser(payload: {
  name: string;
  email: string;
  role: string;
  departmentId?: string;
}) {
  return fetchApi<CreatedTenantUser>("/tenant-users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTenantUserRole(userId: string, role: string) {
  return fetchApi<{ id: string; role: string }>(`/tenant-users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function deactivateTenantUser(userId: string) {
  return fetchApi<TenantUser>(`/tenant-users/${userId}/deactivate`, { method: "POST" });
}

export function reactivateTenantUser(userId: string) {
  return fetchApi<TenantUser>(`/tenant-users/${userId}/reactivate`, { method: "POST" });
}

export function deleteTenantUser(userId: string) {
  return fetchApi<{ id: string; deleted: boolean }>(`/tenant-users/${userId}`, {
    method: "DELETE",
  });
}

export function listWorkforceDirectory() {
  return fetchApi<WorkforceRecord[]>("/workforce");
}
