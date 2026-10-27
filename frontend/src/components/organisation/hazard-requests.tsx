"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";
import { StringListField } from "@/components/organisation/string-list-field";
import { hazardRequestsApi, sitesApi, type HazardCatalogueRequest } from "@/lib/organisation/api";
import { masterDataApi, type MasterDataRecord } from "@/lib/master-data/api";
import { placeApi, type AssetRecord, type WorkLocationRecord } from "@/lib/place/api";

type Draft = {
  name: string;
  description: string;
  risks: string[];
  consequences: string[];
  controls: string[];
  permitTypeCodes: string[];
  workLocationIds: string[];
  assetIds: string[];
  siteId: string;
};

function draftFrom(request: HazardCatalogueRequest): Draft {
  return {
    name: request.name,
    description: request.description ?? "",
    risks: request.risks.length ? request.risks : [""],
    consequences: request.consequences.length ? request.consequences : [""],
    controls: request.controls.length ? request.controls : [""],
    permitTypeCodes: request.permitTypeCode ? [request.permitTypeCode] : [],
    workLocationIds: request.workLocationId ? [request.workLocationId] : [],
    assetIds: request.assets.map((asset) => asset.id),
    siteId: request.siteId ?? "",
  };
}

function filled(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

/** Pending asks to add a permit hazard to this organisation's list. */
export function HazardRequests() {
  const [requests, setRequests] = useState<HazardCatalogueRequest[]>([]);
  const [types, setTypes] = useState<MasterDataRecord[]>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [locations, setLocations] = useState<WorkLocationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    hazardRequestsApi.list().then(setRequests).catch(() => setRequests([]));
  }

  useEffect(() => {
    load();
    masterDataApi.permitTypes().then(setTypes).catch(() => setTypes([]));
    sitesApi.list().then((rows) => setSites(rows.map((row) => ({ id: row.id, name: row.name })))).catch(() => setSites([]));
  }, []);

  useEffect(() => {
    if (!draft?.siteId) {
      setLocations([]);
      setAssets([]);
      return;
    }
    placeApi.listWorkLocations(draft.siteId).then(setLocations).catch(() => setLocations([]));
    placeApi.listAssets(draft.siteId).then(setAssets).catch(() => setAssets([]));
  }, [draft?.siteId]);

  function review(request: HazardCatalogueRequest) {
    setError(null);
    setOpenId(request.id);
    setDraft(draftFrom(request));
  }

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  async function approve(request: HazardCatalogueRequest) {
    if (!draft) return;
    const risks = filled(draft.risks);
    const controls = filled(draft.controls);
    if (!draft.name.trim() || risks.length === 0 || controls.length === 0 || draft.permitTypeCodes.length === 0) {
      setError("Name, one risk, one control and one permit type are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await hazardRequestsApi.approve(request.id, {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        risks,
        consequences: filled(draft.consequences),
        controls,
        permitTypeCodes: draft.permitTypeCodes,
        workLocationIds: draft.workLocationIds,
        assetIds: draft.assetIds,
      });
      toast("Hazard added to the organisation list");
      setOpenId(null);
      setDraft(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the hazard.");
    } finally {
      setSaving(false);
    }
  }

  async function reject(request: HazardCatalogueRequest) {
    if (!(await confirmAction(`Leave "${request.name}" on that permit only? It will not be added to the organisation hazard list.`))) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await hazardRequestsApi.reject(request.id);
      toast("Hazard stays on that permit only");
      setOpenId(null);
      setDraft(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reject the hazard.");
    } finally {
      setSaving(false);
    }
  }

  if (requests.length === 0) return null;

  return (
    <section className="grid gap-3">
      <h2 className="font-semibold">Asked for the hazard list</h2>
      <p className="text-sm text-muted-foreground">
        These were written on a permit. Approving adds a new organisation hazard. The permit keeps the wording that was written.
      </p>
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {requests.map((request) => {
        const open = openId === request.id && draft;
        return (
          <article key={request.id} className="grid gap-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{request.name}</p>
                <p className="text-xs text-muted-foreground">
                  {request.permitReference ? `${request.permitReference} · ` : ""}
                  {request.permitTitle}
                  {request.requestedByName ? ` · ${request.requestedByName}` : ""}
                </p>
              </div>
              {open ? null : (
                <Button type="button" variant="outline" size="sm" onClick={() => review(request)}>
                  Review
                </Button>
              )}
            </div>
            {open ? (
              <div className="grid gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Name</span>
                  <input className={FIELD_CLASS} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></span>
                  <textarea className={FIELD_CLASS} rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                </label>
                <StringListField label="Risks" values={draft.risks} addLabel="Add a risk" onChange={(risks) => setDraft({ ...draft, risks })} />
                <StringListField label="Consequences" values={draft.consequences} addLabel="Add a consequence" onChange={(consequences) => setDraft({ ...draft, consequences })} />
                <StringListField label="Controls" values={draft.controls} addLabel="Add a control" onChange={(controls) => setDraft({ ...draft, controls })} />
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Permit types</legend>
                  <div className="grid max-h-40 gap-1 overflow-auto">
                    {types.map((type) => (
                      <label key={type.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(type.code && draft.permitTypeCodes.includes(type.code))}
                          onChange={() => type.code && setDraft({ ...draft, permitTypeCodes: toggle(draft.permitTypeCodes, type.code) })}
                        />
                        {type.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Site for locations and assets</span>
                  <select className={FIELD_CLASS} value={draft.siteId} onChange={(event) => setDraft({ ...draft, siteId: event.target.value })}>
                    <option value="">Choose a site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </label>
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Work locations</legend>
                  <div className="grid max-h-40 gap-1 overflow-auto">
                    {locations.map((location) => (
                      <label key={location.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.workLocationIds.includes(location.id)}
                          onChange={() => setDraft({ ...draft, workLocationIds: toggle(draft.workLocationIds, location.id) })}
                        />
                        {location.pathText || location.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Assets</legend>
                  <div className="grid max-h-40 gap-1 overflow-auto">
                    {assets.map((asset) => (
                      <label key={asset.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.assetIds.includes(asset.id)}
                          onChange={() => setDraft({ ...draft, assetIds: toggle(draft.assetIds, asset.id) })}
                        />
                        {asset.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={saving} onClick={() => void approve(request)}>
                    Add to the organisation list
                  </Button>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void reject(request)}>
                    Leave it on this permit only
                  </Button>
                  <Button type="button" variant="ghost" disabled={saving} onClick={() => { setOpenId(null); setDraft(null); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
