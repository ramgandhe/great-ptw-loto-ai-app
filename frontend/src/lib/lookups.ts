import { masterDataApi } from "@/lib/master-data/api";
import { departmentsApi, locationsApi, machineryApi, plantsApi, workstationsApi } from "@/lib/organisation/api";
import { listTenantUserNames, listWorkforceDirectory } from "@/lib/workforce/api";

export type NamedRecord = { id: string; name: string; code?: string | null; color?: string | null };
export type PersonRecord = { id: string; name: string; email?: string | null };

export type Lookups = {
  permitTypes: Map<string, NamedRecord>;
  plants: Map<string, NamedRecord>;
  departments: Map<string, NamedRecord>;
  locations: Map<string, NamedRecord>;
  workstations: Map<string, NamedRecord>;
  machinery: Map<string, NamedRecord>;
  people: Map<string, PersonRecord>;
};

function toMap<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

/** Some lists are role-restricted; a denied list just resolves to no names. */
function safe<T>(promise: Promise<T[]>): Promise<T[]> {
  return promise.catch(() => [] as T[]);
}

let cache: Promise<Lookups> | null = null;

/**
 * Names for the IDs that appear on permits, loaded once per session and shared by every screen.
 * People merge login users and workforce records, because executors can be either.
 */
export function loadLookups(): Promise<Lookups> {
  cache ??= Promise.all([
    safe(masterDataApi.permitTypes()),
    safe(plantsApi.list()),
    safe(departmentsApi.list()),
    safe(locationsApi.list()),
    safe(workstationsApi.list()),
    safe(machineryApi.list()),
    safe(listTenantUserNames()),
    safe(listWorkforceDirectory()),
  ]).then(([permitTypes, plants, departments, locations, workstations, machinery, users, workforce]) => {
    const people = new Map<string, PersonRecord>();
    for (const person of workforce) {
      people.set(person.id, { id: person.id, name: person.name, email: person.email });
    }
    for (const user of users) {
      const name =
        user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.username;
      people.set(user.id, { id: user.id, name, email: user.email });
    }
    return {
      permitTypes: toMap(permitTypes),
      plants: toMap(plants),
      departments: toMap(departments),
      locations: toMap(locations),
      workstations: toMap(workstations),
      machinery: toMap(machinery),
      people,
    };
  });
  cache.catch(() => {
    cache = null;
  });
  return cache;
}

/** Name for an ID, or null when it is unset or not visible to this user (never the raw ID). */
export function nameOf(map: Map<string, { name: string }> | undefined, id: string | null | undefined): string | null {
  if (!id) return null;
  return map?.get(id)?.name ?? null;
}
