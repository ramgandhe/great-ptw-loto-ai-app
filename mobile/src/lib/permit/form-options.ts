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
import { listPermitExecutors, type TenantUser } from "@/lib/workforce/api";
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
  userRoles: string[];
};

function executorRoleLabel(kind?: TenantUser["executorKind"]) {
  if (kind === "agency") {
    return "Agency contact";
  }
  if (kind === "contractor") {
    return "Contractor";
  }
  return "Job executor";
}

function tenantUsersToExecutors(users: TenantUser[]): WorkforceRecord[] {
  return users.map((user) => ({
    id: user.id,
    name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.username,
    email: user.email,
    role: executorRoleLabel(user.executorKind),
    executorKind: user.executorKind ?? "internal",
  }));
}

function mergeExecutors(
  directory: WorkforceRecord[],
  profile: Awaited<ReturnType<typeof getProfile>>,
): WorkforceRecord[] {
  const byId = new Map<string, WorkforceRecord>();
  const profileName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username;
  const isOperator = profile.roles.includes("operator");

  for (const person of directory) {
    byId.set(person.id, person);
  }

  if (isOperator && !byId.has(profile.id)) {
    byId.set(profile.id, {
      id: profile.id,
      name: `${profileName} (you)`,
      email: profile.email ?? null,
      role: "Job executor",
      executorKind: "internal",
    });
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
    executorUsers,
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
    listPermitExecutors(),
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
    executors: mergeExecutors(tenantUsersToExecutors(executorUsers), profile),
    userRoles: profile.roles,
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
