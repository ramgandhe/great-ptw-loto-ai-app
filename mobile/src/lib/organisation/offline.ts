import { getCachedResponse, setCachedResponse } from "@/lib/offline/cache";
import { listAssets, listSites, listWorkLocations, type AssetRecord, type PlaceSite, type WorkLocationRecord } from "@/lib/place/api";
import { listDepartments, listLocations, listOrganisations, listPlants } from "./api";
import type { Organisation, OrgRecord } from "./types";

const CACHE_KEYS = {
  organisation: "org:profile",
  plants: "org:plants",
  departments: "org:departments",
  locations: "org:locations",
  sites: "org:sites",
} as const;

async function loadWithCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  try {
    const data = await loader();
    await setCachedResponse(key, data);
    return data;
  } catch {
    const cached = await getCachedResponse<T>(key);
    if (cached) {
      return cached;
    }
    throw new Error("Unable to load organisation data");
  }
}

export function loadOrganisationProfile() {
  return loadWithCache<Organisation[]>(CACHE_KEYS.organisation, listOrganisations);
}

export function loadPlantDirectory() {
  return loadWithCache<OrgRecord[]>(CACHE_KEYS.plants, listPlants);
}

export function loadDepartmentDirectory() {
  return loadWithCache<OrgRecord[]>(CACHE_KEYS.departments, listDepartments);
}

export function loadLocationDirectory() {
  return loadWithCache<OrgRecord[]>(CACHE_KEYS.locations, listLocations);
}

/** Cached sites are the ones this person can open. The list endpoint already applies that. */
export function loadSiteDirectory() {
  return loadWithCache<PlaceSite[]>(CACHE_KEYS.sites, listSites);
}

export function loadWorkLocationDirectory(siteId: string) {
  return loadWithCache<WorkLocationRecord[]>(`org:site:${siteId}:locations`, () => listWorkLocations(siteId));
}

export function loadAssetDirectory(siteId: string, workLocationId?: string) {
  const key = workLocationId ? `org:site:${siteId}:assets:${workLocationId}` : `org:site:${siteId}:assets`;
  return loadWithCache<AssetRecord[]>(key, () => listAssets(siteId, workLocationId));
}
