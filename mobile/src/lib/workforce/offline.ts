import { getCachedResponse, setCachedResponse } from "@/lib/offline/cache";
import { listCompetencies, listEmployees, listWorkforceDirectory } from "./api";
import type { CompetencyRecord, WorkforceRecord } from "./types";

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
    throw new Error("Unable to load workforce data");
  }
}

export function loadWorkforceDirectory() {
  return loadWithCache<WorkforceRecord[]>("wfm:directory", listWorkforceDirectory);
}

export function loadMyProfile() {
  return loadWithCache<WorkforceRecord[]>("wfm:employees", listEmployees);
}

export function loadCompetencies() {
  return loadWithCache<CompetencyRecord[]>("wfm:competencies", listCompetencies);
}

export function loadCertifications() {
  return loadCompetencies();
}
