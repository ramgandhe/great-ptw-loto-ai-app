import { fetchApi } from "@/lib/api/client";
import type { CompetencyRecord, WorkforceRecord } from "./types";

export function listWorkforceDirectory() {
  return fetchApi<WorkforceRecord[]>("/workforce");
}

export function listCompetencies() {
  return fetchApi<CompetencyRecord[]>("/competencies");
}

export function listEmployees() {
  return fetchApi<WorkforceRecord[]>("/employees");
}
