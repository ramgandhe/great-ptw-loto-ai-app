import { fetchApi } from "@/lib/api";
import { forceQuery } from "@/lib/confirm-delete";

export type MasterDataRecord = {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  isActive?: boolean;
};

export type HazardRecord = MasterDataRecord & {
  category?: string | null;
  severity?: string;
  consequences?: string[];
  controls?: string[];
  permitTypeCodes?: string[];
};

export const masterDataApi = {
  permitTypes: () => fetchApi<MasterDataRecord[]>("/permit-types"),
  createPermitType: (payload: {
    code: string;
    name: string;
    description?: string;
    color?: string;
    isActive?: boolean;
  }) =>
    fetchApi<MasterDataRecord>("/permit-types", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePermitType: (
    id: string,
    payload: { code?: string; name?: string; description?: string; color?: string; isActive?: boolean },
  ) =>
    fetchApi<MasterDataRecord>(`/permit-types/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deletePermitType: (id: string, force = false) =>
    fetchApi<MasterDataRecord>(`/permit-types/${id}${forceQuery(force)}`, { method: "DELETE" }),
  importDefaults: () =>
    fetchApi<{ created: number; updated: number }>("/permit-types/import-defaults", { method: "POST" }),
  hazards: () => fetchApi<HazardRecord[]>("/hazards"),
  ppe: () => fetchApi<MasterDataRecord[]>("/ppe"),
  importHazardDefaults: () =>
    fetchApi<{ created: number; updated: number }>("/hazards/import-defaults", { method: "POST" }),
};

export type GasDefault = {
  parameter: string;
  unit: string;
  minimum: number;
  maximum: number;
  catalogueId?: string;
  minimumSource: { kind: string; id: string; name: string };
  maximumSource: { kind: string; id: string; name: string };
};

export type GasTestingRecord = {
  id: string;
  workstationId?: string | null;
  workLocationId?: string | null;
  assetId?: string | null;
  parameter: string;
  unit: string;
  minimum: number;
  maximum: number;
  isActive?: boolean;
};

export const gasTestingApi = {
  list: (workstationId?: string) => {
    const query = workstationId ? `?workstationId=${encodeURIComponent(workstationId)}` : "";
    return fetchApi<GasTestingRecord[]>(`/gas-testing${query}`);
  },
  create: (payload: {
    workstationId?: string;
    workLocationId?: string;
    assetId?: string;
    parameter: string;
    unit: string;
    minimum: number;
    maximum: number;
  }) =>
    fetchApi<GasTestingRecord>("/gas-testing", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (
    id: string,
    payload: {
      workstationId?: string;
      workLocationId?: string;
      assetId?: string;
      parameter?: string;
      unit?: string;
      minimum?: number;
      maximum?: number;
      isActive?: boolean;
    },
  ) =>
    fetchApi<GasTestingRecord>(`/gas-testing/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  defaults: (workLocationId: string, assetIds: string[] = []) => {
    const params = new URLSearchParams({ workLocationId });
    for (const id of assetIds) params.append("assetId", id);
    return fetchApi<GasDefault[]>(`/gas-testing/defaults?${params.toString()}`);
  },
  remove: (id: string, force = false) =>
    fetchApi<GasTestingRecord>(`/gas-testing/${id}${forceQuery(force)}`, { method: "DELETE" }),
};
