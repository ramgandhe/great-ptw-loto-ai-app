import { fetchApi } from "@/lib/api";

export type PlaceSite = {
  id: string;
  code: string;
  name: string;
  status: string;
  pathText?: string | null;
};

export type WorkLocationRecord = {
  id: string;
  siteId: string;
  code: string;
  name: string;
  parentId: string | null;
  locationTypeId: string | null;
  description: string | null;
  address: string | null;
  status: string;
  pathText: string | null;
};

export type WorkLocationDetail = WorkLocationRecord & {
  approvers: { userIds: string[]; inheritedFrom: string | null; warning: boolean };
  ownApproverIds: string[];
};

export type NamedType = { id: string; name: string; status: string; description?: string | null };

export type AssetRecord = {
  id: string;
  siteId: string;
  workLocationId: string;
  tag: string;
  assetNumber: string | null;
  name: string;
  assetTypeId: string | null;
  parentAssetId: string | null;
  description: string | null;
  status: string;
};

export type SiteMember = { id: string; siteId: string; userId: string };

export const placeApi = {
  listWorkLocations: (siteId: string) =>
    fetchApi<WorkLocationRecord[]>(`/work-locations?siteId=${encodeURIComponent(siteId)}`),
  getWorkLocation: (id: string) => fetchApi<WorkLocationDetail>(`/work-locations/${id}`),
  createWorkLocation: (payload: {
    siteId: string;
    code: string;
    name: string;
    parentId?: string;
    locationTypeId?: string;
    description?: string;
  }) => fetchApi<WorkLocationRecord>("/work-locations", { method: "POST", body: JSON.stringify(payload) }),
  updateWorkLocation: (
    id: string,
    payload: {
      code?: string;
      name?: string;
      parentId?: string | null;
      locationTypeId?: string | null;
      description?: string;
    },
  ) => fetchApi<WorkLocationRecord>(`/work-locations/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  archiveWorkLocation: (id: string) =>
    fetchApi<WorkLocationRecord>(`/work-locations/${id}/archive`, { method: "POST" }),
  putApprovers: (id: string, userIds: string[]) =>
    fetchApi<WorkLocationDetail["approvers"]>(`/work-locations/${id}/approvers`, {
      method: "PUT",
      body: JSON.stringify({ userIds }),
    }),
  listLocationTypes: () => fetchApi<NamedType[]>("/location-types"),
  createLocationType: (payload: { name: string; description?: string }) =>
    fetchApi<NamedType>("/location-types", { method: "POST", body: JSON.stringify(payload) }),
  updateLocationType: (id: string, payload: { name?: string; description?: string | null }) =>
    fetchApi<NamedType>(`/location-types/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteLocationType: (id: string, force = false) =>
    fetchApi<{ deleted: boolean }>(`/location-types/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
  getAsset: (id: string) => fetchApi<AssetRecord>(`/assets/${id}`),
  listAssets: (siteId: string, workLocationId?: string) => {
    const params = new URLSearchParams({ siteId });
    if (workLocationId) params.set("workLocationId", workLocationId);
    return fetchApi<AssetRecord[]>(`/assets?${params.toString()}`);
  },
  createAsset: (payload: {
    tag: string;
    name: string;
    workLocationId: string;
    assetNumber?: string;
    assetTypeId?: string;
    parentAssetId?: string;
    description?: string;
  }) => fetchApi<AssetRecord>("/assets", { method: "POST", body: JSON.stringify(payload) }),
  updateAsset: (
    id: string,
    payload: {
      tag?: string;
      name?: string;
      workLocationId?: string;
      assetNumber?: string | null;
      assetTypeId?: string | null;
      parentAssetId?: string | null;
      description?: string;
    },
  ) => fetchApi<AssetRecord>(`/assets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  archiveAsset: (id: string) => fetchApi<AssetRecord>(`/assets/${id}/archive`, { method: "POST" }),
  deleteAsset: (id: string, options?: { confirm?: boolean; deleteLototo?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.confirm) params.set("confirm", "true");
    if (options?.deleteLototo) params.set("deleteLototo", "true");
    const query = params.toString();
    return fetchApi<{ deleted: boolean }>(`/assets/${id}/delete${query ? `?${query}` : ""}`, { method: "POST" });
  },
  listAssetTypes: () => fetchApi<NamedType[]>("/asset-types"),
  createAssetType: (name: string) =>
    fetchApi<NamedType>("/asset-types", { method: "POST", body: JSON.stringify({ name }) }),
  listMembers: (siteId: string) => fetchApi<SiteMember[]>(`/sites/${siteId}/members`),
  addMember: (siteId: string, userId: string) =>
    fetchApi<SiteMember>(`/sites/${siteId}/members`, { method: "POST", body: JSON.stringify({ userId }) }),
  removeMember: (siteId: string, userId: string, confirm = false) =>
    fetchApi<{ removed: boolean }>(
      `/sites/${siteId}/members/${encodeURIComponent(userId)}${confirm ? "?confirm=true" : ""}`,
      { method: "DELETE" },
    ),
};
