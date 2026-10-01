import { useEffect, useState } from "react";
import { listLocations } from "@/lib/organisation/api";

/** Names for the ids a permit carries, so screens show "Compressor Bay", not an identifier. */
export function useOrgNames(): { location: (id: string) => string } {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    listLocations().then((locations) => setNames(new Map(locations.map((row) => [row.id, row.name]))), () => undefined);
  }, []);
  // Until names load (or when a record is out of view), say so rather than show the id.
  const name = (id: string) => (id ? (names.get(id) ?? "Not available") : "—");
  return { location: name };
}
