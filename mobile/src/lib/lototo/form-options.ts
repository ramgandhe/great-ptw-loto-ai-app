import { getProfile } from "@/lib/auth/api";
import { listMachinery, listWorkstations } from "@/lib/organisation/api";
import type { MachineryRecord } from "@/lib/organisation/types";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { listLototoEligiblePermits } from "./permit-eligibility";
import type { LototoAssignmentRole } from "./types";

export const ENERGY_SOURCE_OPTIONS = [
  { value: "electrical", label: "Electrical" },
  { value: "mechanical", label: "Mechanical" },
  { value: "hydraulic", label: "Hydraulic" },
  { value: "pneumatic", label: "Pneumatic" },
  { value: "thermal", label: "Thermal" },
  { value: "chemical", label: "Chemical" },
  { value: "gravitational", label: "Gravitational" },
] as const;

export const ASSIGNMENT_ROLE_OPTIONS: { value: LototoAssignmentRole; label: string }[] = [
  { value: "isolation_officer", label: "Isolation officer" },
  { value: "verifier", label: "Verifier" },
  { value: "supervisor", label: "Supervisor" },
];

export type LototoFormOptions = {
  permits: Awaited<ReturnType<typeof listLototoEligiblePermits>>;
  workstations: Awaited<ReturnType<typeof listWorkstations>>;
  machinery: MachineryRecord[];
  personnel: WorkforceRecord[];
};

function mergePersonnel(
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

export async function loadLototoFormOptions(): Promise<LototoFormOptions> {
  const [permits, workstations, machinery, workforce, profile] = await Promise.all([
    listLototoEligiblePermits(),
    listWorkstations(),
    listMachinery(),
    listWorkforceDirectory().catch(() => [] as WorkforceRecord[]),
    getProfile(),
  ]);

  return {
    permits,
    workstations,
    machinery,
    personnel: mergePersonnel(workforce, profile),
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
