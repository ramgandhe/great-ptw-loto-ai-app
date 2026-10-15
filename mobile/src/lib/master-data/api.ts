import { fetchApi } from "@/lib/api/client";

export type MasterDataRecord = {
  id: string;
  code?: string | null;
  name: string;
  /** Permit types: the colour the organisation chose. */
  color?: string | null;
};

export type HazardRecord = MasterDataRecord & {
  category?: string | null;
  description?: string | null;
  severity?: string;
  consequences?: string[];
  controls?: string[];
  permitTypeCodes?: string[];
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

export type GasDefault = {
  parameter: string;
  unit: string;
  minimum: number;
  maximum: number;
  catalogueId?: string;
  minimumSource?: { kind: string; id: string; name: string };
  maximumSource?: { kind: string; id: string; name: string };
};

/** Strictest limits from the work location and the selected assets. */
export function gasDefaults(workLocationId: string, assetIds: string[] = []) {
  const params = new URLSearchParams({ workLocationId });
  for (const id of assetIds) params.append("assetId", id);
  return fetchApi<GasDefault[]>(`/gas-testing/defaults?${params.toString()}`);
}
