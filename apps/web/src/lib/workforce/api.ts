import { fetchApi } from "@/lib/api";
import type { CompetencyRecord, WorkforceRecord } from "./types";

function crud<T extends { id: string }>(basePath: string) {
  return {
    list: () => fetchApi<T[]>(basePath),
    create: (payload: Partial<T>) =>
      fetchApi<T>(basePath, { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<T>) =>
      fetchApi<T>(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    archive: (id: string) => fetchApi<void>(`${basePath}/${id}`, { method: "DELETE" }),
  };
}

export const employeesApi = crud<WorkforceRecord>("/employees");
export const contractorsApi = crud<WorkforceRecord>("/contractors");
export const agenciesApi = crud<WorkforceRecord>("/agencies");
export const competenciesApi = crud<CompetencyRecord>("/competencies");

export function assignUserRole(userId: string, role: string) {
  return fetchApi<void>(`/users/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export function listWorkforceDirectory() {
  return fetchApi<WorkforceRecord[]>("/workforce");
}
