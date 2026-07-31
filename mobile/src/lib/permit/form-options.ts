import { getProfile } from "@/lib/auth/api";
import { masterDataApi, type MasterDataRecord } from "@/lib/master-data/api";
import {
  listDepartments,
  listLocations,
  listMachinery,
  listPlants,
  listWorkstations,
} from "@/lib/organisation/api";
import type { MachineryRecord } from "@/lib/organisation/types";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";

export type PermitFormOptions = {
  permitTypes: MasterDataRecord[];
  plants: MasterDataRecord[];
  departments: MasterDataRecord[];
  locations: MasterDataRecord[];
  workstations: MasterDataRecord[];
  machinery: MachineryRecord[];
  hazards: MasterDataRecord[];
  ppe: MasterDataRecord[];
  executors: WorkforceRecord[];
};

function mergeExecutors(
  directory: WorkforceRecord[],
  profile: Awaited<ReturnType<typeof getProfile>>,
): WorkforceRecord[] {
  const byId = new Map<string, WorkforceRecord>();
  const profileName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username;

  byId.set(profile.id, {
    id: profile.id,
    name: `${profileName} (you)`,
    email: profile.email ?? null,
    role: profile.roles[0] ?? "signed-in user",
  });

  for (const person of directory) {
    byId.set(person.id, person);
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatOrgOptionLabel(item: { name: string; code?: string | null }): string {
  return item.code ? `${item.name} (${item.code})` : item.name;
}

export function formatWorkforceOptionLabel(person: {
  name: string;
  email?: string | null;
  role?: string | null;
}): string {
  const parts = [person.name];
  if (person.email) {
    parts.push(person.email);
  }
  if (person.role) {
    parts.push(person.role);
  }
  return parts.join(" · ");
}

export async function loadPermitFormOptions(): Promise<PermitFormOptions> {
  const [
    permitTypes,
    plants,
    departments,
    locations,
    workstations,
    machinery,
    hazards,
    ppe,
    workforce,
    profile,
  ] = await Promise.all([
    masterDataApi.permitTypes(),
    listPlants(),
    listDepartments(),
    listLocations(),
    listWorkstations(),
    listMachinery(),
    masterDataApi.hazards(),
    masterDataApi.ppe(),
    listWorkforceDirectory().catch(() => [] as WorkforceRecord[]),
    getProfile(),
  ]);

  return {
    permitTypes,
    plants,
    departments,
    locations,
    workstations,
    machinery,
    hazards,
    ppe,
    executors: mergeExecutors(workforce, profile),
  };
}

export function filterMachineryByWorkstation(
  machinery: MachineryRecord[],
  workstationId?: string | null,
): MachineryRecord[] {
  if (!workstationId) {
    return machinery;
  }
  return machinery.filter((item) => item.workstationId === workstationId);
}
