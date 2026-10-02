import { fetchApi } from "@/lib/api/client";
import type { CompetencyRecord, WorkforceRecord } from "./types";

export type TenantUser = {
  id: string;
  email: string | null;
  username: string;
  name?: string | null;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  roles: string[];
  executorKind?: "internal" | "contractor" | "agency";
};

export function listWorkforceDirectory() {
  return fetchApi<WorkforceRecord[]>("/workforce");
}

/** Sign-in accounts by name, for choosing a person (investigator, action owner). */
export function listTenantUserNames() {
  return fetchApi<TenantUser[]>("/tenant-users/names");
}

export function listPermitExecutors() {
  return fetchApi<TenantUser[]>("/tenant-users/executors");
}

export function listCompetencies() {
  return fetchApi<CompetencyRecord[]>("/competencies");
}

export function listEmployees() {
  return fetchApi<WorkforceRecord[]>("/employees");
}
