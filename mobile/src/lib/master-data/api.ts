import { fetchApi } from "@/lib/api/client";

export type MasterDataRecord = {
  id: string;
  code?: string | null;
  name: string;
};

export const masterDataApi = {
  permitTypes: () => fetchApi<MasterDataRecord[]>("/permit-types"),
  hazards: () => fetchApi<MasterDataRecord[]>("/hazards"),
  ppe: () => fetchApi<MasterDataRecord[]>("/ppe"),
};
