import { getProfile } from "@/lib/auth/api";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { listLototoEligiblePermits } from "./permit-eligibility";
import type { LototoAssignmentRole } from "./types";

export const ENERGY_SOURCE_OPTIONS = [
  { value: "electrical", label: "Electrical" },
  { value: "mechanical", label: "Mechanical" },
  { value: "hydraulic", label: "Hydraulic" },
  { value: "pneumatic", label: "Pneumatic" },
  { value: "chemical", label: "Chemical" },
  { value: "thermal", label: "Thermal" },
  { value: "pressure", label: "Pressure" },
  { value: "gravity", label: "Gravity" },
  { value: "gravitational", label: "Gravity" },
  { value: "stored_energy", label: "Stored Energy" },
  { value: "radiation", label: "Radiation" },
  { value: "other", label: "Other" },
] as const;

export const ASSIGNMENT_ROLE_OPTIONS: { value: LototoAssignmentRole; label: string }[] = [
  { value: "permit-operator", label: "Permit operator" },
  { value: "safety-officer", label: "Safety officer" },
  { value: "permit-approver", label: "Permit approver" },
];

export type LototoFormOptions = {
  permits: Awaited<ReturnType<typeof listLototoEligiblePermits>>;
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
  const [permits, workforce, profile] = await Promise.all([
    listLototoEligiblePermits(),
    listWorkforceDirectory().catch(() => [] as WorkforceRecord[]),
    getProfile(),
  ]);

  return {
    permits,
    personnel: mergePersonnel(workforce, profile),
  };
}
