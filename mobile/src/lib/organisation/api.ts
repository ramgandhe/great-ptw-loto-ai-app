import { fetchApi } from "@/lib/api/client";
import type { MachineryRecord, Organisation, OrgRecord } from "./types";

export function listOrganisations() {
  return fetchApi<Organisation[]>("/organisations");
}

export function listPlants() {
  return fetchApi<OrgRecord[]>("/plants");
}

export function listDepartments() {
  return fetchApi<OrgRecord[]>("/departments");
}

export function listLocations() {
  return fetchApi<OrgRecord[]>("/locations");
}

export function listWorkstations() {
  return fetchApi<OrgRecord[]>("/workstations");
}

export function listMachinery() {
  return fetchApi<MachineryRecord[]>("/machinery");
}
