"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { sitesApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { placeApi, type WorkLocationRecord } from "@/lib/place/api";
import { AppSelect } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { AdminEmbedContext, AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";

function LocationBranch({ rows, parentId }: { rows: WorkLocationRecord[]; parentId: string | null }) {
  const children = rows.filter((row) => (row.parentId ?? null) === parentId).sort((a, b) => a.name.localeCompare(b.name));
  if (children.length === 0) return null;
  return (
    <ul className={parentId ? "ml-4 border-l border-border pl-2" : "grid gap-1"}>
      {children.map((row) => (
        <li key={row.id}>
          <div className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
            <div className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="truncate">{row.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{row.code}</span>
            </div>
            <Link href={`/organisation/work-locations/${row.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              View
            </Link>
          </div>
          <LocationBranch rows={rows} parentId={row.id} />
        </li>
      ))}
    </ul>
  );
}

export default function WorkLocationsPage() {
  const embedded = useContext(AdminEmbedContext);
  const requestedSite = useSearchParams().get("siteId");
  const [sites, setSites] = useState<OrgRecord[]>([]);
  const [siteId, setSiteId] = useState("");
  const [rows, setRows] = useState<WorkLocationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadLocations(nextSiteId: string) {
    setRows(await placeApi.listWorkLocations(nextSiteId));
  }

  useEffect(() => {
    sitesApi
      .list()
      .then((siteRows) => {
        const active = siteRows.filter((site) => site.status !== "archived");
        setSites(active);
        const first = !embedded && requestedSite && active.some((site) => site.id === requestedSite) ? requestedSite : (active[0]?.id ?? "");
        setSiteId(first);
        if (first) return loadLocations(first);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load work locations"))
      .finally(() => setLoading(false));
  }, [embedded, requestedSite]);

  async function changeSite(next: string) {
    setSiteId(next);
    setError(null);
    try {
      await loadLocations(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load work locations");
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Work locations"
        description="Any depth under a site. A location filter on permits includes the locations under it."
        back={embedded ? undefined : { href: "/organisation", label: "Organisation" }}
        action={
          siteId ? (
            <Link href={`/organisation/work-locations/new?siteId=${siteId}`} className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              Add location
            </Link>
          ) : null
        }
      />
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && sites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a{" "}
          <Link href="/organisation/sites" className="text-primary hover:underline">
            site
          </Link>{" "}
          first.
        </p>
      ) : null}
      {sites.length > 0 ? (
        <label className="grid max-w-sm gap-1.5 text-sm">
          <span className="font-medium">Site</span>
          <AppSelect className={FIELD_CLASS} value={siteId} onChange={(event) => void changeSite(event.target.value)}>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </AppSelect>
        </label>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {siteId && rows.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">No work locations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the first area people will name on a permit.</p>
        </div>
      ) : siteId ? (
        <LocationBranch rows={rows} parentId={null} />
      ) : null}
      <div className="flex justify-end">
        <Link href="/organisation/work-locations/types" className={buttonVariants({ variant: "outline" })}>
          Add Location Type
        </Link>
      </div>
    </AdminPage>
  );
}
