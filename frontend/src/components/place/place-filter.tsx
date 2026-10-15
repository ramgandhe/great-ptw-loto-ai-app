"use client";

import { useEffect, useRef, useState } from "react";
import { sitesApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { placeApi, type WorkLocationRecord } from "@/lib/place/api";

const SELECT = "h-10 min-w-40 rounded-lg border border-border bg-background px-3 text-sm";

/** A work location plus every location under it. */
export function idsUnder(locationId: string, rows: { id: string; parentId: string | null }[]): Set<string> {
  const ids = new Set<string>([locationId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const row of rows) {
      if (row.parentId && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function PlaceFilter({
  siteId,
  workLocationId,
  onChange,
  onLocations,
}: {
  siteId: string;
  workLocationId: string;
  onChange: (next: { siteId: string; workLocationId: string }) => void;
  onLocations?: (rows: WorkLocationRecord[]) => void;
}) {
  const [sites, setSites] = useState<OrgRecord[]>([]);
  const [locations, setLocations] = useState<WorkLocationRecord[]>([]);
  const onLocationsRef = useRef(onLocations);
  onLocationsRef.current = onLocations;

  useEffect(() => {
    sitesApi.list().then((rows) => setSites(rows.filter((row) => row.status !== "archived"))).catch(() => setSites([]));
  }, []);

  useEffect(() => {
    if (!siteId) {
      setLocations([]);
      onLocationsRef.current?.([]);
      return;
    }
    placeApi.listWorkLocations(siteId).then((rows) => {
      setLocations(rows);
      onLocationsRef.current?.(rows);
    }).catch(() => {
      setLocations([]);
      onLocationsRef.current?.([]);
    });
  }, [siteId]);

  return (
    <div className="flex flex-wrap gap-2">
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Site</span>
        <select
          className={SELECT}
          value={siteId}
          onChange={(event) => onChange({ siteId: event.target.value, workLocationId: "" })}
        >
          <option value="">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Work location</span>
        <select
          className={SELECT}
          value={workLocationId}
          disabled={!siteId}
          onChange={(event) => onChange({ siteId, workLocationId: event.target.value })}
        >
          <option value="">{siteId ? "Whole site, including sub-locations" : "Select a site first"}</option>
          {locations.map((row) => (
            <option key={row.id} value={row.id}>{row.pathText || row.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
