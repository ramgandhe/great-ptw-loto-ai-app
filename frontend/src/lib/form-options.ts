import {
  departmentsApi,
  locationsApi,
  plantsApi,
  workstationsApi,
} from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { agenciesApi, listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";

export type EntitySelectResource =
  | "plant"
  | "department"
  | "location"
  | "workstation"
  | "agency"
  | "workforce";

export type SelectOption = {
  value: string;
  label: string;
};

export const ASSIGNABLE_ROLES: SelectOption[] = [
  { value: "org-admin", label: "Organisation admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "verifier", label: "Verifier" },
  { value: "isolation-officer", label: "Isolation officer" },
  { value: "job-issuer", label: "Job issuer" },
  { value: "viewer", label: "Viewer" },
  { value: "operator", label: "Operator" },
];

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

export async function loadEntitySelectOptions(
  resources: EntitySelectResource[],
): Promise<Partial<Record<EntitySelectResource, SelectOption[]>>> {
  const unique = [...new Set(resources)];
  const entries = await Promise.all(
    unique.map(async (resource) => {
      switch (resource) {
        case "plant": {
          const rows = await plantsApi.list();
          return [resource, rows.map((row) => ({ value: row.id, label: formatOrgOptionLabel(row) }))] as const;
        }
        case "department": {
          const rows = await departmentsApi.list();
          return [resource, rows.map((row) => ({ value: row.id, label: formatOrgOptionLabel(row) }))] as const;
        }
        case "location": {
          const rows = await locationsApi.list();
          return [resource, rows.map((row) => ({ value: row.id, label: formatOrgOptionLabel(row) }))] as const;
        }
        case "workstation": {
          const rows = await workstationsApi.list();
          return [resource, rows.map((row) => ({ value: row.id, label: formatOrgOptionLabel(row) }))] as const;
        }
        case "agency": {
          const rows = await agenciesApi.list();
          return [
            resource,
            rows.map((row: OrgRecord) => ({ value: row.id, label: formatOrgOptionLabel(row) })),
          ] as const;
        }
        case "workforce": {
          const rows = await listWorkforceDirectory().catch(() => [] as WorkforceRecord[]);
          return [
            resource,
            rows.map((row) => ({ value: row.id, label: formatWorkforceOptionLabel(row) })),
          ] as const;
        }
      }
    }),
  );

  return Object.fromEntries(entries) as Partial<Record<EntitySelectResource, SelectOption[]>>;
}
