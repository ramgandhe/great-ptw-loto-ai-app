import { fetchApi } from "@/lib/api/client";

export type MasterDataRecord = {
  id: string;
  code?: string | null;
  name: string;
};

export type HazardRecord = MasterDataRecord & {
  category?: string | null;
  description?: string | null;
  severity?: string;
  consequences?: string[];
  controls?: string[];
};

export const masterDataApi = {
  permitTypes: () => fetchApi<MasterDataRecord[]>("/permit-types"),
  hazards: () => fetchApi<HazardRecord[]>("/hazards"),
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

export function listGasTesting(workstationId?: string) {
  const query = workstationId ? `?workstationId=${encodeURIComponent(workstationId)}` : "";
  return fetchApi<GasTestingRecord[]>(`/gas-testing${query}`);
}
