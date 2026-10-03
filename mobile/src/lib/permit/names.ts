import { useEffect, useState } from "react";
import { masterDataApi } from "@/lib/master-data/api";
import { listLocations } from "@/lib/organisation/api";

type PermitTypeName = { name: string; color: string | null };

/** Names for the ids a permit carries, so screens show "Compressor Bay", not an identifier. */
export function useOrgNames(): { location: (id: string) => string; permitType: (id: string) => PermitTypeName | null } {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [types, setTypes] = useState<Map<string, PermitTypeName>>(new Map());
  useEffect(() => {
    listLocations().then((locations) => setNames(new Map(locations.map((row) => [row.id, row.name]))), () => undefined);
    masterDataApi.permitTypes().then(
      (rows) => setTypes(new Map(rows.map((row) => [row.id, { name: row.name, color: row.color ?? null }]))),
      () => undefined,
    );
  }, []);
  // Until names load (or when a record is out of view), say so rather than show the id.
  const name = (id: string) => (id ? (names.get(id) ?? "Not available") : "—");
  return { location: name, permitType: (id: string) => types.get(id) ?? null };
}
