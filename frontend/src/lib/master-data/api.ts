import { fetchApi } from "@/lib/api";

export type MasterDataRecord = {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  color?: string | null;
  isActive?: boolean;
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
  deletePermitType: (id: string) =>
    fetchApi<MasterDataRecord>(`/permit-types/${id}`, { method: "DELETE" }),
  hazards: () => fetchApi<(MasterDataRecord & { severity?: string })[]>("/hazards"),
  ppe: () => fetchApi<MasterDataRecord[]>("/ppe"),
};

export type GasTestingRecord = {
  id: string;
  workstationId: string;
  parameter: string;
  unit: string;
  minimum: number;
  maximum: number;
};

export const gasTestingApi = {
  list: (workstationId?: string) => {
    const query = workstationId ? `?workstationId=${encodeURIComponent(workstationId)}` : "";
    return fetchApi<GasTestingRecord[]>(`/gas-testing${query}`);
  },
  create: (payload: {
    workstationId: string;
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
      parameter?: string;
      unit?: string;
      minimum?: number;
      maximum?: number;
    },
  ) =>
    fetchApi<GasTestingRecord>(`/gas-testing/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => fetchApi<GasTestingRecord>(`/gas-testing/${id}`, { method: "DELETE" }),
};
