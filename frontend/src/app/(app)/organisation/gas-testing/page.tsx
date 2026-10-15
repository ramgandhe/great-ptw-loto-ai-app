"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { deleteWithAssignmentConfirm } from "@/lib/confirm-delete";
import { gasTestingApi, type GasTestingRecord } from "@/lib/master-data/api";
import { sitesApi, workstationsApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { placeApi, type AssetRecord, type WorkLocationRecord } from "@/lib/place/api";
import { formatOrgOptionLabel } from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/ui/row-actions";
import { OrgStatusBadge, stateOf } from "@/components/organisation/org-status-badge";
import { toast } from "@/components/ui/toast";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";

type TargetKind = "work_location" | "asset" | "workstation";

const emptyForm = {
  targetKind: "work_location" as TargetKind,
  siteId: "",
  targetId: "",
  parameter: "",
  unit: "",
  minimum: "",
  maximum: "",
};

export default function GasTestingConfigPage() {
  const [items, setItems] = useState<GasTestingRecord[]>([]);
  const [sites, setSites] = useState<OrgRecord[]>([]);
  const [locations, setLocations] = useState<WorkLocationRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [catalogLocations, setCatalogLocations] = useState<WorkLocationRecord[]>([]);
  const [catalogAssets, setCatalogAssets] = useState<AssetRecord[]>([]);
  const [workstations, setWorkstations] = useState<OrgRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inheritFor, setInheritFor] = useState("");
  const [saving, setSaving] = useState(false);
  const addAnother = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  function load() {
    return Promise.all([gasTestingApi.list(), sitesApi.list(), workstationsApi.list()])
      .then(async ([rows, siteRows, workstationRows]) => {
        const activeSites = siteRows.filter((site) => site.status !== "archived");
        const [locationGroups, assetGroups] = await Promise.all([
          Promise.all(activeSites.map((site) => placeApi.listWorkLocations(site.id).catch(() => []))),
          Promise.all(activeSites.map((site) => placeApi.listAssets(site.id).catch(() => []))),
        ]);
        setItems(rows);
        setSites(activeSites);
        setWorkstations(workstationRows);
        setCatalogLocations(locationGroups.flat());
        setCatalogAssets(assetGroups.flat());
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load gas testing configuration"),
      );
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!form.siteId || form.targetKind === "workstation") {
      setLocations([]);
      setAssets([]);
      return;
    }
    const siteId = form.siteId;
    Promise.all([placeApi.listWorkLocations(siteId), placeApi.listAssets(siteId)])
      .then(([locationRows, assetRows]) => {
        setLocations(locationRows);
        setAssets(assetRows);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load places"));
  }, [form.siteId, form.targetKind]);

  function targetOf(item: GasTestingRecord): { targetKind: TargetKind; targetId: string } {
    if (item.assetId) return { targetKind: "asset", targetId: item.assetId };
    if (item.workLocationId) return { targetKind: "work_location", targetId: item.workLocationId };
    return { targetKind: "workstation", targetId: item.workstationId ?? "" };
  }

  function openForm(item?: GasTestingRecord) {
    setEditingId(item?.id ?? null);
    const target = item ? targetOf(item) : { targetKind: "work_location" as TargetKind, targetId: "" };
    const knownSite =
      catalogLocations.find((row) => row.id === target.targetId)?.siteId ??
      catalogAssets.find((row) => row.id === target.targetId)?.siteId ??
      sites[0]?.id ??
      "";
    setForm(
      item
        ? {
            ...emptyForm,
            ...target,
            siteId: knownSite,
            parameter: item.parameter,
            unit: item.unit,
            minimum: String(item.minimum),
            maximum: String(item.maximum),
          }
        : { ...emptyForm, siteId: sites[0]?.id ?? "" },
    );
    setError(null);
    setSavedMessage(null);
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, siteId: sites[0]?.id ?? "" });
    setFormOpen(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const minimum = Number(form.minimum);
    const maximum = Number(form.maximum);
    if (!form.targetId || !form.parameter.trim() || !form.unit.trim()) {
      setError("A place or asset, parameter, and unit are required.");
      return;
    }
    if (Number.isNaN(minimum) || Number.isNaN(maximum) || minimum >= maximum) {
      setError("Minimum must be a number below the maximum.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      parameter: form.parameter.trim(),
      unit: form.unit.trim(),
      minimum,
      maximum,
      ...(form.targetKind === "asset" ? { assetId: form.targetId } : {}),
      ...(form.targetKind === "work_location" ? { workLocationId: form.targetId } : {}),
      ...(form.targetKind === "workstation" ? { workstationId: form.targetId } : {}),
    };
    try {
      if (editingId) await gasTestingApi.update(editingId, payload);
      else await gasTestingApi.create(payload);
      setSavedMessage(`${editingId ? "Saved" : "Added"} ${payload.parameter}.`);
      if (addAnother.current && !editingId) {
        setForm((prev) => ({ ...emptyForm, targetKind: prev.targetKind, siteId: prev.siteId, targetId: prev.targetId }));
      } else {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save gas testing item");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(item: GasTestingRecord, on: boolean) {
    if (!on && !window.confirm(`Deactivate ${item.parameter}? It stays on this list but is not offered on permits.`)) return;
    setError(null);
    try {
      await gasTestingApi.update(item.id, { isActive: on });
      toast(`${item.parameter} ${on ? "activated" : "deactivated"}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `${on ? "Activate" : "Deactivate"} failed`);
    }
  }

  async function handleDelete(id: string) {
    const name = items.find((item) => item.id === id)?.parameter ?? "this gas test";
    setError(null);
    try {
      const ok = await deleteWithAssignmentConfirm(name, (force) =>
        gasTestingApi.remove(id, force).then(() => undefined),
      );
      if (!ok) return;
      toast(`${name} deleted`);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete gas testing item");
    }
  }

  function ancestorIds(id: string): string[] {
    const byId = new Map(catalogLocations.map((row) => [row.id, row]));
    const ids: string[] = [];
    const seen = new Set<string>();
    let current = byId.get(id)?.parentId ?? null;
    while (current && !seen.has(current)) {
      seen.add(current);
      ids.push(current);
      current = byId.get(current)?.parentId ?? null;
    }
    return ids;
  }

  const shown: Array<GasTestingRecord & { inheritedFrom?: string }> = inheritFor
    ? [
        ...items.filter((item) => item.workLocationId === inheritFor),
        ...ancestorIds(inheritFor).flatMap((id) => {
          const source = catalogLocations.find((row) => row.id === id);
          const name = source?.pathText || source?.name || "a parent location";
          return items
            .filter((item) => item.workLocationId === id || item.workstationId === id)
            .map((item) => ({ ...item, inheritedFrom: name }));
        }),
      ]
    : items;

  function appliesTo(item: GasTestingRecord & { inheritedFrom?: string }): string {
    if (item.assetId) {
      const asset = catalogAssets.find((row) => row.id === item.assetId);
      return asset ? `Asset ${asset.tag}` : "Asset";
    }
    if (item.workLocationId) {
      const location = catalogLocations.find((row) => row.id === item.workLocationId);
      const label = location ? location.pathText || location.name : "Work location";
      return item.inheritedFrom ? `Inherited from ${item.inheritedFrom}` : label;
    }
    const workstation = workstations.find((row) => row.id === item.workstationId);
    return workstation ? formatOrgOptionLabel(workstation) : "Workstation";
  }

  const canAdd = sites.length > 0 || workstations.length > 0;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Gas testing"
        description="Limits for a work location or an asset. Child locations inherit them and may only make a limit stricter."
        action={
          !formOpen ? (
            <Button type="button" size="lg" onClick={() => openForm()} disabled={!loading && !canAdd}>
              <Plus aria-hidden />
              Add parameter
            </Button>
          ) : null
        }
      />
      {!loading && !canAdd ? (
        <p className="text-sm text-muted-foreground">
          Add a <Link href="/organisation/sites" className="text-primary hover:underline">site</Link> and a work location first.
        </p>
      ) : null}
      {savedMessage ? <p role="status" className="text-sm font-medium text-(--status-success)">{savedMessage}</p> : null}
      {formOpen ? (
        <form ref={formRef} onSubmit={(event) => void handleSubmit(event)} className="reveal-in grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">{editingId ? `Edit ${form.parameter || "parameter"}` : "New parameter"}</h2>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Applies to</span>
            <select
              className={FIELD_CLASS}
              value={form.targetKind}
              onChange={(event) => setForm((prev) => ({ ...prev, targetKind: event.target.value as TargetKind, targetId: "" }))}
            >
              <option value="work_location">Work location</option>
              <option value="asset">Asset</option>
              <option value="workstation">Workstation</option>
            </select>
          </label>
          {form.targetKind === "workstation" ? null : (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Site</span>
              <select className={FIELD_CLASS} value={form.siteId} onChange={(event) => setForm((prev) => ({ ...prev, siteId: event.target.value, targetId: "" }))}>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">{form.targetKind === "asset" ? "Asset" : form.targetKind === "work_location" ? "Work location" : "Workstation"}</span>
            <select required className={FIELD_CLASS} value={form.targetId} onChange={(event) => setForm((prev) => ({ ...prev, targetId: event.target.value }))}>
              <option value="">Select</option>
              {form.targetKind === "workstation"
                ? workstations.map((item) => (
                    <option key={item.id} value={item.id}>{formatOrgOptionLabel(item)}</option>
                  ))
                : form.targetKind === "asset"
                  ? assets.map((item) => (
                      <option key={item.id} value={item.id}>{item.tag} — {item.name}</option>
                    ))
                  : locations.map((item) => (
                      <option key={item.id} value={item.id}>{item.pathText || item.name}</option>
                    ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Parameter</span>
            <input required className={FIELD_CLASS} value={form.parameter} placeholder="Oxygen" onChange={(event) => setForm((prev) => ({ ...prev, parameter: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Unit</span>
            <input required className={FIELD_CLASS} value={form.unit} placeholder="%" onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Minimum</span>
            <input required type="number" step="any" className={FIELD_CLASS} value={form.minimum} onChange={(event) => setForm((prev) => ({ ...prev, minimum: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Maximum</span>
            <input required type="number" step="any" className={FIELD_CLASS} value={form.maximum} onChange={(event) => setForm((prev) => ({ ...prev, maximum: event.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving} onClick={() => (addAnother.current = false)}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add parameter"}
            </Button>
            {!editingId ? (
              <Button type="submit" variant="outline" disabled={saving} onClick={() => (addAnother.current = true)}>
                Add and add another
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}
      {catalogLocations.length > 0 ? (
        <label className="grid max-w-xl gap-1.5 text-sm">
          <span className="font-medium">Show inheritance for</span>
          <select className={FIELD_CLASS} value={inheritFor} onChange={(event) => setInheritFor(event.target.value)}>
            <option value="">All configured tests</option>
            {catalogLocations.map((row) => (
              <option key={row.id} value={row.id}>{row.pathText || row.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      {inheritFor ? (
        <p className="text-sm text-muted-foreground">Tests from parent locations are listed as inherited. Editing one changes it on that parent. A child can add its own test or store a stricter limit.</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">No gas testing parameters yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the first parameter so permits can record gas readings.</p>
        </div>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Parameter</th>
                <th className="px-4 py-2.5 font-medium">Applies to</th>
                <th className="px-4 py-2.5 font-medium">Safe range</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={`${item.id}-${item.inheritedFrom ?? "own"}`} className={`row-hover cursor-pointer border-t border-border first:border-t-0 ${editingId === item.id ? "bg-muted/60" : ""}`} onClick={() => openForm(item)}>
                  <td className="px-4 py-3 font-medium">{item.parameter}</td>
                  <td className="px-4 py-3 text-muted-foreground">{appliesTo(item)}</td>
                  <td className="px-4 py-3 tabular-nums">{item.minimum} to {item.maximum} {item.unit}</td>
                  <td className="px-4 py-3"><OrgStatusBadge status={stateOf(item)} /></td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => openForm(item) },
                        item.isActive === false
                          ? { label: "Activate", onClick: () => void handleSetActive(item, true) }
                          : { label: "Deactivate", onClick: () => void handleSetActive(item, false) },
                        { label: "Delete", danger: true, onClick: () => void handleDelete(item.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
