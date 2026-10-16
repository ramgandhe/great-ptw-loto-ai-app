"use client";
import { AppSelect } from "@/components/ui/select";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { sitesApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { placeApi, type AssetRecord, type NamedType, type WorkLocationRecord } from "@/lib/place/api";
import { getLototoProcedure, listLototoProcedures } from "@/lib/lototo/api";
import type { LototoProcedureListItem } from "@/lib/lototo/types";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { toast } from "@/components/ui/toast";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";

const emptyForm = {
  tag: "",
  name: "",
  workLocationId: "",
  assetNumber: "",
  assetTypeId: "",
  parentAssetId: "",
  description: "",
};

export default function AssetsPage() {
  const [sites, setSites] = useState<OrgRecord[]>([]);
  const [siteId, setSiteId] = useState("");
  const [locations, setLocations] = useState<WorkLocationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [types, setTypes] = useState<NamedType[]>([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [typeName, setTypeName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [procedures, setProcedures] = useState<LototoProcedureListItem[]>([]);
  const [energyTypes, setEnergyTypes] = useState<string[]>([]);

  const locationName = useMemo(() => new Map(locations.map((row) => [row.id, row.pathText || row.name])), [locations]);

  useEffect(() => {
    if (!editingId) {
      setProcedures([]);
      setEnergyTypes([]);
      return;
    }
    listLototoProcedures({ assetId: editingId })
      .then(async (rows) => {
        setProcedures(rows);
        const details = await Promise.all(rows.map((row) => getLototoProcedure(row.id).catch(() => null)));
        const types = new Set<string>();
        for (const detail of details) {
          const version = detail?.publishedVersion ?? detail?.draftVersion;
          for (const point of version?.lockoutPoints ?? []) {
            if (point.energyType) types.add(point.energyType);
          }
        }
        setEnergyTypes([...types]);
      })
      .catch(() => {
        setProcedures([]);
        setEnergyTypes([]);
      });
  }, [editingId]);

  async function loadSite(nextSiteId: string, workLocationId = "") {
    const [locationRows, assetRows, typeRows] = await Promise.all([
      placeApi.listWorkLocations(nextSiteId),
      placeApi.listAssets(nextSiteId, workLocationId || undefined),
      placeApi.listAssetTypes(),
    ]);
    setLocations(locationRows);
    setAssets(assetRows);
    setTypes(typeRows.filter((type) => type.status !== "archived"));
  }

  useEffect(() => {
    sitesApi
      .list()
      .then((siteRows) => {
        const active = siteRows.filter((site) => site.status !== "archived");
        setSites(active);
        const first = active[0]?.id ?? "";
        setSiteId(first);
        if (first) return loadSite(first);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load assets"))
      .finally(() => setLoading(false));
  }, []);

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm, workLocationId: locationFilter });
    setFormOpen(true);
    setError(null);
  }

  function openExisting(asset: AssetRecord) {
    setEditingId(asset.id);
    setForm({
      tag: asset.tag,
      name: asset.name,
      workLocationId: asset.workLocationId,
      assetNumber: asset.assetNumber ?? "",
      assetTypeId: asset.assetTypeId ?? "",
      parentAssetId: asset.parentAssetId ?? "",
      description: asset.description ?? "",
    });
    setFormOpen(true);
    setError(null);
  }

  async function changeSite(next: string) {
    setSiteId(next);
    setLocationFilter("");
    setFormOpen(false);
    setEditingId(null);
    try {
      await loadSite(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load assets");
    }
  }

  async function changeLocationFilter(next: string) {
    setLocationFilter(next);
    try {
      setAssets(await placeApi.listAssets(siteId, next || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load assets");
    }
  }

  async function saveAsset(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await placeApi.updateAsset(editingId, {
          tag: form.tag.trim(),
          name: form.name.trim(),
          workLocationId: form.workLocationId,
          assetNumber: form.assetNumber.trim() || null,
          assetTypeId: form.assetTypeId || null,
          parentAssetId: form.parentAssetId || null,
          description: form.description.trim(),
        });
        toast("Asset saved");
      } else {
        await placeApi.createAsset({
          tag: form.tag.trim(),
          name: form.name.trim(),
          workLocationId: form.workLocationId,
          ...(form.assetNumber.trim() ? { assetNumber: form.assetNumber.trim() } : {}),
          ...(form.assetTypeId ? { assetTypeId: form.assetTypeId } : {}),
          ...(form.parentAssetId ? { parentAssetId: form.parentAssetId } : {}),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
        });
        toast("Asset added");
        setFormOpen(false);
      }
      await loadSite(siteId, locationFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this asset");
    } finally {
      setSaving(false);
    }
  }

  async function archiveAsset(asset: AssetRecord) {
    if (!(await confirmAction(`Archive ${asset.tag}? It stays on closed permits.`))) return;
    setError(null);
    try {
      await placeApi.archiveAsset(asset.id);
      toast(`${asset.tag} archived`);
      if (editingId === asset.id) setFormOpen(false);
      await loadSite(siteId, locationFilter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to archive this asset");
    }
  }

  async function deleteAsset(asset: AssetRecord) {
    if (!(await confirmAction(`Permanently delete ${asset.tag}? This cannot be undone.`))) return;
    setError(null);
    const finish = async () => {
      toast(`${asset.tag} deleted`);
      if (editingId === asset.id) setFormOpen(false);
      await loadSite(siteId, locationFilter);
    };
    try {
      await placeApi.deleteAsset(asset.id);
      await finish();
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== "IN_USE") {
        setError(err instanceof ApiError ? err.message : "Failed to delete this asset");
        return;
      }
      const lines = Array.isArray(err.details) ? err.details.map(String) : [];
      const extra = lines.length ? `\n\n${lines.map((line) => `• ${line}`).join("\n")}` : "";
      if (!(await confirmAction(`${asset.tag} is still used.${extra}\n\nDelete anyway?`))) return;
      const hasLototo = lines.some((line) => line.toLowerCase().includes("lototo"));
      const deleteLototo = hasLototo
        ? await confirmAction("Delete the LOTOTO for this asset as well?\n\nDelete removes the procedure. Cancel keeps the LOTOTO and still deletes the asset.")
        : false;
      try {
        await placeApi.deleteAsset(asset.id, { confirm: true, deleteLototo });
        await finish();
      } catch (next) {
        setError(next instanceof ApiError ? next.message : "Failed to delete this asset");
      }
    }
  }

  async function addType(event: React.FormEvent) {
    event.preventDefault();
    const name = typeName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await placeApi.createAssetType(name);
      setTypes((await placeApi.listAssetTypes()).filter((type) => type.status !== "archived"));
      setTypeName("");
      toast("Asset type added");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add this asset type");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Assets"
        description="Equipment register. A permit lists assets only when the job needs them. LOTOTO always needs at least one."
        action={
          siteId && locations.length > 0 && !formOpen ? (
            <Button type="button" size="lg" onClick={openNew}>
              <Plus aria-hidden />
              Add asset
            </Button>
          ) : null
        }
      />
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && sites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a <Link href="/organisation/sites" className="text-primary hover:underline">site</Link> first.
        </p>
      ) : null}
      {sites.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          <label className="grid min-w-52 gap-1.5 text-sm">
            <span className="font-medium">Site</span>
            <AppSelect className={FIELD_CLASS} value={siteId} onChange={(event) => void changeSite(event.target.value)}>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </AppSelect>
          </label>
          <label className="grid min-w-64 flex-1 gap-1.5 text-sm">
            <span className="font-medium">Work location</span>
            <AppSelect className={FIELD_CLASS} value={locationFilter} onChange={(event) => void changeLocationFilter(event.target.value)}>
              <option value="">Whole site</option>
              {locations.map((row) => (
                <option key={row.id} value={row.id}>{row.pathText || row.name}</option>
              ))}
            </AppSelect>
          </label>
        </div>
      ) : null}
      {siteId && locations.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">
          Add a <Link href="/organisation/work-locations" className="text-primary hover:underline">work location</Link> before registering assets.
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {formOpen ? (
        <form onSubmit={(event) => void saveAsset(event)} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">{editingId ? "Asset details" : "New asset"}</h2>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Tag</span>
            <input required className={FIELD_CLASS} value={form.tag} onChange={(event) => setForm((prev) => ({ ...prev, tag: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <input required className={FIELD_CLASS} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Work location</span>
            <AppSelect required className={FIELD_CLASS} value={form.workLocationId} onChange={(event) => setForm((prev) => ({ ...prev, workLocationId: event.target.value }))}>
              <option value="">Select a location</option>
              {locations.map((row) => (
                <option key={row.id} value={row.id}>{row.pathText || row.name}</option>
              ))}
            </AppSelect>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Asset number</span>
            <input className={FIELD_CLASS} value={form.assetNumber} onChange={(event) => setForm((prev) => ({ ...prev, assetNumber: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Type</span>
            <AppSelect className={FIELD_CLASS} value={form.assetTypeId} onChange={(event) => setForm((prev) => ({ ...prev, assetTypeId: event.target.value }))}>
              <option value="">No type</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </AppSelect>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Part of</span>
            <AppSelect className={FIELD_CLASS} value={form.parentAssetId} onChange={(event) => setForm((prev) => ({ ...prev, parentAssetId: event.target.value }))}>
              <option value="">No parent asset</option>
              {assets.filter((asset) => asset.id !== editingId).map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.tag} — {asset.name}</option>
              ))}
            </AppSelect>
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Description</span>
            <textarea className={`${FIELD_CLASS} h-20 py-2`} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save asset" : "Add asset"}</Button>
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
          </div>
        </form>
      ) : null}
      {editingId ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">LOTOTO</h2>
            <Link href={`/lototo/procedures/new?assetId=${editingId}`} className="text-sm text-primary underline">New procedure</Link>
          </div>
          <p className="text-sm text-muted-foreground">Procedures and the energy they isolate are stored on this asset.</p>
          {energyTypes.length > 0 ? (
            <p className="text-sm">Energy sources: {energyTypes.join(", ")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No energy sources on these procedures yet.</p>
          )}
          {procedures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No procedures for this asset.</p>
          ) : (
            <ul className="grid gap-2">
              {procedures.map((row) => (
                <li key={row.id}>
                  <Link href={`/lototo/procedures/${row.id}`} className="text-sm underline">{row.code} — {row.title}</Link>
                  <span className="ml-2 text-xs text-muted-foreground">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {!loading && siteId && locations.length > 0 && assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">No assets yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Register the equipment this site isolates and works on.</p>
        </div>
      ) : assets.length > 0 ? (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Tag</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Work location</th>
                <th className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="row-hover cursor-pointer border-t border-border first:border-t-0" onClick={() => openExisting(asset)}>
                  <td className="px-4 py-3 font-mono text-xs">{asset.tag}</td>
                  <td className="px-4 py-3 font-medium">{asset.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{locationName.get(asset.workLocationId) ?? "Unknown location"}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => openExisting(asset) },
                        { label: "Archive", danger: true, onClick: () => void archiveAsset(asset) },
                        { label: "Delete", danger: true, onClick: () => void deleteAsset(asset) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Asset types</h2>
        <p className="text-sm text-muted-foreground">Labels only.</p>
        {types.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {types.map((type) => (
              <li key={type.id} className="rounded-md border border-border px-2 py-1 text-sm">{type.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No types yet.</p>
        )}
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void addType(event)}>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">New type</span>
            <input className={FIELD_CLASS} value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Pump" />
          </label>
          <Button type="submit" disabled={saving || !typeName.trim()}>Add type</Button>
        </form>
      </section>
    </AdminPage>
  );
}
