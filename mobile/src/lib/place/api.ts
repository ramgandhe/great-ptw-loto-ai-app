import { fetchApi } from "@/lib/api/client";

export type PlaceSite = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export type WorkLocationRecord = {
  id: string;
  siteId: string;
  code: string;
  name: string;
  parentId: string | null;
  pathText: string | null;
  status: string;
};

export type AssetRecord = {
  id: string;
  siteId: string;
  workLocationId: string;
  tag: string;
  name: string;
  status: string;
};

/** Sites the signed-in person can use. Owner and tenant admin receive every site. */
export function listSites() {
  return fetchApi<PlaceSite[]>("/sites");
}

export function listWorkLocations(siteId: string) {
  return fetchApi<WorkLocationRecord[]>(`/work-locations?siteId=${encodeURIComponent(siteId)}`);
}

/** Assets at this work location and its sub-locations. */
export function listAssets(siteId: string, workLocationId?: string) {
  const params = new URLSearchParams({ siteId });
  if (workLocationId) params.set("workLocationId", workLocationId);
  return fetchApi<AssetRecord[]>(`/assets?${params.toString()}`);
}

export function getAsset(id: string) {
  return fetchApi<AssetRecord>(`/assets/${id}`);
}
