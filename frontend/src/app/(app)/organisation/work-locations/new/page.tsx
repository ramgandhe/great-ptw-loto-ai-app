"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppSelect } from "@/components/ui/select";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { sitesApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { placeApi, type NamedType, type WorkLocationRecord } from "@/lib/place/api";
import { emptyWorkLocationDraft, WorkLocationFields, type WorkLocationDraft } from "@/components/organisation/work-location-fields";

export default function NewWorkLocationPage() {
  const router = useRouter();
  const requestedSite = useSearchParams().get("siteId") ?? "";
  const [sites, setSites] = useState<OrgRecord[]>([]);
  const [siteId, setSiteId] = useState(requestedSite);
  const [parents, setParents] = useState<WorkLocationRecord[]>([]);
  const [types, setTypes] = useState<NamedType[]>([]);
  const [form, setForm] = useState<WorkLocationDraft>(emptyWorkLocationDraft());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([sitesApi.list(), placeApi.listLocationTypes()])
      .then(([siteRows, locationTypes]) => {
        const active = siteRows.filter((site) => site.status !== "archived");
        setSites(active);
        setTypes(locationTypes.filter((type) => type.status !== "archived"));
        const first = active.some((site) => site.id === requestedSite) ? requestedSite : (active[0]?.id ?? "");
        setSiteId(first);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load sites"))
      .finally(() => setLoading(false));
  }, [requestedSite]);

  useEffect(() => {
    if (!siteId) return;
    placeApi
      .listWorkLocations(siteId)
      .then(setParents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load work locations"));
  }, [siteId]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!siteId) return;
    setSaving(true);
    setError(null);
    try {
      const created = await placeApi.createWorkLocation({
        siteId,
        name: form.name.trim(),
        code: form.code.trim(),
        ...(form.parentId ? { parentId: form.parentId } : {}),
        ...(form.locationTypeId ? { locationTypeId: form.locationTypeId } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        hazardIds: form.hazardIds,
      });
      toast("Work location added");
      router.push(`/organisation/work-locations/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this work location");
    } finally {
      setSaving(false);
    }
  }

  const back = { href: siteId ? `/organisation/work-locations?siteId=${siteId}` : "/organisation/work-locations", label: "Work locations" };

  return (
    <AdminPage>
      <AdminPageHeader title="Add location" description="A place under a site that permits can name." back={back} />
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {!loading && sites.length === 0 ? <p className="text-sm text-muted-foreground">Add a site first.</p> : null}
      {siteId ? (
        <form onSubmit={(event) => void save(event)} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Site</span>
            <AppSelect
              className={FIELD_CLASS}
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value);
                setForm((current) => ({ ...current, parentId: "" }));
              }}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </AppSelect>
          </label>
          <WorkLocationFields form={form} parents={parents} types={types} onChange={setForm} />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add location"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push(back.href)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </AdminPage>
  );
}
