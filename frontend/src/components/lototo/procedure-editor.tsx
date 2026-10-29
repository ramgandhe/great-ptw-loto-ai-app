"use client";
import { AppSelect } from "@/components/ui/select";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { deleteWithAssignmentConfirm } from "@/lib/confirm-delete";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { LOTOTO_LIBRARY_WRITE_ROLES } from "@/lib/auth/roles";
import { energySourceChoices, useEnergySourceOptions } from "@/lib/lototo/energy-sources";
import { energyLevelHint, ISOLATION_METHODS, proofsForEnergy } from "@/lib/lototo/point-fields";
import {
  createLototoProcedure,
  deactivateLototoProcedure,
  deleteLototoProcedure,
  getLototoProcedure,
  publishLototoProcedure,
  reactivateLototoProcedure,
  removeLototoPointPhoto,
  reviseLototoProcedure,
  updateLototoProcedure,
  uploadLototoPointPhoto,
} from "@/lib/lototo/api";
import type { LototoLockoutPoint, LototoProcedure, LototoProcedurePayload } from "@/lib/lototo/types";
import { sitesApi } from "@/lib/organisation/api";
import { placeApi, type AssetRecord, type WorkLocationRecord } from "@/lib/place/api";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const ROLE_OPTIONS = [
  { value: "permit-operator", label: "Permit operator" },
  { value: "safety-officer", label: "Safety officer" },
  { value: "permit-approver", label: "Permit approver" },
  { value: "permit-receiver", label: "Permit receiver" },
];

function emptyPoint(order: number): LototoLockoutPoint {
  return {
    sortOrder: order,
    pointCode: "",
    energyType: "electrical",
    energyOtherText: "",
    magnitude: "",
    locationText: "",
    method: "lock_closed",
    normalPosition: "",
    isolatedPosition: "",
    action: "",
    restoreAction: "",
    device: "",
    proof: "meter",
    drawingReference: "",
    removeOrder: null,
  };
}

type FormState = {
  machineryId: string;
  workLocationId: string;
  assetId: string;
  workstationId: string;
  code: string;
  title: string;
  reviewDueOn: string;
  note: string;
  lockoutPoints: LototoLockoutPoint[];
  authorizedRoles: string[];
};

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function fromProcedure(detail: LototoProcedure): FormState {
  const version = detail.draftVersion ?? detail.publishedVersion;
  return {
    machineryId: detail.machineryId ?? "",
    workLocationId: detail.workLocationId ?? "",
    assetId: detail.assetId || detail.machineryId || "",
    workstationId: detail.workstationId ?? "",
    code: detail.code,
    title: detail.title,
    reviewDueOn: dateInput(detail.reviewDueOn),
    note: version?.note ?? "",
    lockoutPoints: version?.lockoutPoints.length
      ? version.lockoutPoints.map((point) => ({
          ...point,
          proof: point.proof || proofsForEnergy(point.energyType)[0]?.value || "visual",
          method: point.method || "lock_closed",
        }))
      : [emptyPoint(1)],
    authorizedRoles: version?.authorizedRoles ?? [],
  };
}

function payloadOf(form: FormState): LototoProcedurePayload {
  return {
    assetId: form.assetId || undefined,
    workLocationId: form.assetId ? undefined : form.workLocationId || undefined,
    machineryId: form.assetId || form.workLocationId ? undefined : form.machineryId || undefined,
    workstationId: form.workstationId || undefined,
    code: form.code.trim(),
    title: form.title.trim(),
    reviewDueOn: form.reviewDueOn || null,
    note: form.note.trim() || undefined,
    lockoutPoints: form.lockoutPoints
      .filter((point) => point.pointCode.trim())
      .map((point, index) => ({
        sortOrder: index + 1,
        pointCode: point.pointCode.trim(),
        energyType: point.energyType,
        energyOtherText: point.energyType === "other" ? point.energyOtherText?.trim() || undefined : undefined,
        magnitude: point.magnitude?.trim() || undefined,
        locationText: point.locationText?.trim() || undefined,
        method: point.method || undefined,
        normalPosition: point.normalPosition?.trim() || undefined,
        isolatedPosition: point.isolatedPosition?.trim() || undefined,
        action: point.action?.trim() || undefined,
        restoreAction: point.restoreAction?.trim() || undefined,
        device: point.device?.trim() || undefined,
        proof: point.proof || undefined,
        drawingReference: point.drawingReference?.trim() || undefined,
        removeOrder: point.removeOrder || undefined,
      })),
    authorizedRoles: form.authorizedRoles,
  };
}

export function LototoProcedureEditor({
  procedureId,
  initialMachineryId,
}: {
  procedureId?: string;
  initialMachineryId?: string;
}) {
  const router = useRouter();
  const energyOptions = useEnergySourceOptions();
  const { roles } = useAuthProfile();
  const canWrite = hasAnyRole(roles, LOTOTO_LIBRARY_WRITE_ROLES);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [locations, setLocations] = useState<WorkLocationRecord[]>([]);
  const [detail, setDetail] = useState<LototoProcedure | null>(null);
  const [form, setForm] = useState<FormState>({
    machineryId: "",
    workLocationId: "",
    assetId: initialMachineryId ?? "",
    workstationId: "",
    code: "",
    title: "",
    reviewDueOn: "",
    note: "",
    lockoutPoints: [emptyPoint(1)],
    authorizedRoles: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(procedureId));
  const [saving, setSaving] = useState(false);

  const locked = Boolean(detail && !detail.draftVersion && (detail.status === "published" || detail.status === "inactive"));
  const readOnly = !canWrite || locked;

  useEffect(() => {
    sitesApi.list().then(async (sites) => {
      const active = sites.filter((site) => site.status !== "archived");
      const [assetGroups, locationGroups] = await Promise.all([
        Promise.all(active.map((site) => placeApi.listAssets(site.id).catch(() => []))),
        Promise.all(active.map((site) => placeApi.listWorkLocations(site.id).catch(() => []))),
      ]);
      setAssets(assetGroups.flat());
      setLocations(locationGroups.flat());
    }).catch(() => {
      setAssets([]);
      setLocations([]);
    });
  }, []);

  useEffect(() => {
    if (form.workLocationId || !form.assetId) return;
    const asset = assets.find((item) => item.id === form.assetId);
    if (!asset?.workLocationId) return;
    setForm((current) => (current.workLocationId ? current : { ...current, workLocationId: asset.workLocationId }));
  }, [assets, form.assetId, form.workLocationId]);

  useEffect(() => {
    if (!procedureId) return;
    getLototoProcedure(procedureId)
      .then((row) => {
        setDetail(row);
        setForm(fromProcedure(row));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Procedure could not be loaded."))
      .finally(() => setLoading(false));
  }, [procedureId]);

  const selectedAsset = useMemo(
    () => assets.find((item) => item.id === form.assetId),
    [assets, form.assetId],
  );
  const locationAssets = assets.filter((item) => item.workLocationId === form.workLocationId);

  function setPoint(index: number, patch: Partial<LototoLockoutPoint>) {
    setForm((current) => ({
      ...current,
      lockoutPoints: current.lockoutPoints.map((point, i) => {
        if (i !== index) return point;
        const next = { ...point, ...patch };
        if (patch.energyType && !proofsForEnergy(next.energyType).some((item) => item.value === next.proof)) {
          next.proof = proofsForEnergy(next.energyType)[0]?.value ?? "visual";
        }
        return next;
      }),
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    if (!form.workLocationId && !form.assetId && !form.machineryId) {
      setError("Choose a work location.");
      setSaving(false);
      return;
    }
    try {
      const saved = procedureId
        ? await updateLototoProcedure(procedureId, payloadOf(form))
        : await createLototoProcedure(payloadOf(form));
      setDetail(saved);
      setForm(fromProcedure(saved));
      if (!procedureId) router.replace(`/lototo/procedures/${saved.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the procedure.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!procedureId) {
      await save();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateLototoProcedure(procedureId, payloadOf(form));
      const published = await publishLototoProcedure(procedureId);
      setDetail(published);
      setForm(fromProcedure(published));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not publish.");
    } finally {
      setSaving(false);
    }
  }

  async function revise() {
    if (!procedureId) return;
    setSaving(true);
    setError(null);
    try {
      const next = await reviseLototoProcedure(procedureId);
      setDetail(next);
      setForm(fromProcedure(next));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create a revision.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!procedureId || !(await confirmAction("Deactivate this procedure? It will no longer be offered on new permits."))) return;
    setSaving(true);
    setError(null);
    try {
      const next = await deactivateLototoProcedure(procedureId);
      setDetail(next);
      setForm(fromProcedure(next));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not deactivate.");
    } finally {
      setSaving(false);
    }
  }

  async function reactivate() {
    if (!procedureId) return;
    setSaving(true);
    setError(null);
    try {
      const next = await reactivateLototoProcedure(procedureId);
      setDetail(next);
      setForm(fromProcedure(next));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reactivate.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!procedureId) return;
    try {
      const ok = await deleteWithAssignmentConfirm(form.title || "this procedure", (force) =>
        deleteLototoProcedure(procedureId, force).then(() => undefined),
      );
      if (!ok) return;
      router.push("/lototo/procedures");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete.");
    }
  }

  if (loading) {
    return <p className="px-4 text-sm text-muted-foreground sm:px-8">Loading procedure…</p>;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        title={procedureId ? form.title || "LOTOTO procedure" : "New LOTOTO procedure"}
        description="The method for one work location, or for one asset. Publishing freezes this version for jobs that use it."
        back={{ href: "/lototo/procedures", label: "LOTOTO procedures" }}
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              {detail?.status === "published" && locked ? (
                <Button type="button" onClick={() => void revise()} disabled={saving}>New revision</Button>
              ) : detail?.status !== "inactive" ? (
                <>
                  <Button type="button" variant="outline" onClick={() => void save()} disabled={saving}>Save draft</Button>
                  <Button type="button" onClick={() => void publish()} disabled={saving}>Publish</Button>
                </>
              ) : null}
              {locked && detail?.status === "published" ? (
                <Button type="button" variant="outline" onClick={() => void deactivate()} disabled={saving}>Deactivate</Button>
              ) : null}
              {detail?.status === "inactive" ? (
                <Button type="button" onClick={() => void reactivate()} disabled={saving}>Reactivate</Button>
              ) : null}
              {procedureId && (detail?.status === "draft" || detail?.status === "inactive") ? (
                <Button type="button" variant="outline" onClick={() => void remove()}>Delete</Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {detail?.publishedVersion ? (
        <p className="text-sm text-muted-foreground">
          Published v{detail.publishedVersion.versionNumber}
          {detail.draftVersion ? ` · editing draft v${detail.draftVersion.versionNumber}` : ""}
          {detail.reviewDueOn ? ` · review ${dateInput(detail.reviewDueOn)}` : ""}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Procedure</h2>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Procedure ID</span>
          <input className={FIELD} value={form.code} disabled={readOnly} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="A-1107-MXZ01" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input className={FIELD} value={form.title} disabled={readOnly} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Bucket elevator lockout" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Work location</span>
          <AppSelect
            className={FIELD}
            value={form.workLocationId}
            disabled={readOnly}
            onChange={(e) => {
              const workLocationId = e.target.value;
              const stillThere = assets.some((item) => item.id === form.assetId && item.workLocationId === workLocationId);
              setForm({ ...form, workLocationId, assetId: stillThere ? form.assetId : "" });
            }}
          >
            <option value="">Select a work location</option>
            {locations.map((item) => (
              <option key={item.id} value={item.id}>{item.pathText || item.name}</option>
            ))}
          </AppSelect>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Asset</span>
          <AppSelect
            className={FIELD}
            value={form.assetId}
            disabled={readOnly || !form.workLocationId}
            onChange={(e) => setForm({ ...form, assetId: e.target.value })}
          >
            <option value="">{form.workLocationId ? "None — this procedure is for the location" : "Select a work location first"}</option>
            {locationAssets.map((item) => (
              <option key={item.id} value={item.id}>{item.tag} — {item.name}</option>
            ))}
          </AppSelect>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Review due</span>
          <input className={FIELD} type="date" value={form.reviewDueOn} disabled={readOnly} onChange={(e) => setForm({ ...form, reviewDueOn: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Note</span>
          <textarea className={`${FIELD} min-h-20`} disabled={readOnly} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={selectedAsset ? `${selectedAsset.tag} ${selectedAsset.name}` : "Anything the isolator should know before starting"} />
        </label>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Isolation points</h2>
          {readOnly ? null : (
            <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, lockoutPoints: [...current.lockoutPoints, emptyPoint(current.lockoutPoints.length + 1)] }))}>
              <Plus className="size-4" /> Add point
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Each device is isolated and restored from this card. Leave restore order blank to restore in reverse.</p>
        {form.lockoutPoints.map((point, index) => {
          const proofs = proofsForEnergy(point.energyType);
          return (
            <div key={point.id ?? index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
              <div className="flex items-center justify-between sm:col-span-2">
                <span className="text-xs font-medium text-muted-foreground">Point {index + 1}</span>
                {readOnly ? null : (
                  <button type="button" className="text-muted-foreground" aria-label="Remove point" onClick={() => setForm((current) => ({ ...current, lockoutPoints: current.lockoutPoints.filter((_, i) => i !== index) }))}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Point code</span>
                <input className={FIELD} disabled={readOnly} value={point.pointCode} onChange={(e) => setPoint(index, { pointCode: e.target.value })} placeholder="E-1" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Device</span>
                <input className={FIELD} disabled={readOnly} value={point.device ?? ""} onChange={(e) => setPoint(index, { device: e.target.value })} placeholder="Breaker, valve, or flange" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Energy</span>
                <AppSelect className={FIELD} disabled={readOnly} value={point.energyType} onChange={(e) => setPoint(index, { energyType: e.target.value })}>
                  {energySourceChoices(energyOptions, point.energyType).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </AppSelect>
              </label>
              {point.energyType === "other" ? (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Other energy</span>
                  <input className={FIELD} disabled={readOnly} value={point.energyOtherText ?? ""} onChange={(e) => setPoint(index, { energyOtherText: e.target.value })} />
                </label>
              ) : null}
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Energy level</span>
                <input className={FIELD} disabled={readOnly} value={point.magnitude ?? ""} placeholder={energyLevelHint(point.energyType)} onChange={(e) => setPoint(index, { magnitude: e.target.value })} />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-medium">Place</span>
                <input className={FIELD} disabled={readOnly} value={point.locationText ?? ""} onChange={(e) => setPoint(index, { locationText: e.target.value })} placeholder="MCC-2, panel A, or the local isolator" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Method</span>
                <AppSelect className={FIELD} disabled={readOnly} value={point.method ?? ""} onChange={(e) => setPoint(index, { method: e.target.value })}>
                  {ISOLATION_METHODS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </AppSelect>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Proof</span>
                <AppSelect className={FIELD} disabled={readOnly} value={point.proof ?? ""} onChange={(e) => setPoint(index, { proof: e.target.value })}>
                  {proofs.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </AppSelect>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Normal position</span>
                <input className={FIELD} disabled={readOnly} value={point.normalPosition ?? ""} onChange={(e) => setPoint(index, { normalPosition: e.target.value })} placeholder="On, open, or running" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Isolated position</span>
                <input className={FIELD} disabled={readOnly} value={point.isolatedPosition ?? ""} onChange={(e) => setPoint(index, { isolatedPosition: e.target.value })} placeholder="Off, closed, or removed" />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-medium">How to isolate</span>
                <textarea className={`${FIELD} min-h-16`} disabled={readOnly} value={point.action ?? ""} onChange={(e) => setPoint(index, { action: e.target.value })} />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-medium">How to restore</span>
                <textarea className={`${FIELD} min-h-16`} disabled={readOnly} value={point.restoreAction ?? ""} onChange={(e) => setPoint(index, { restoreAction: e.target.value })} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Drawing reference</span>
                <input className={FIELD} disabled={readOnly} value={point.drawingReference ?? ""} onChange={(e) => setPoint(index, { drawingReference: e.target.value })} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Restore order</span>
                <input
                  className={FIELD}
                  type="number"
                  min={1}
                  disabled={readOnly}
                  value={point.removeOrder ?? ""}
                  placeholder="Blank restores in reverse"
                  onChange={(e) => setPoint(index, { removeOrder: e.target.value ? Number(e.target.value) : null })}
                />
              </label>
              <div className="grid gap-2 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Photo (optional)</span>
                {point.photo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={point.photo.url} alt="" className="max-h-40 w-fit rounded-md border border-border object-contain" />
                ) : null}
                {readOnly ? null : point.id && procedureId ? (
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        void uploadLototoPointPhoto(procedureId, point.id!, file)
                          .then((saved) => {
                            setDetail(saved);
                            setForm(fromProcedure(saved));
                          })
                          .catch((err) => setError(err instanceof ApiError ? err.message : "Photo could not be saved."));
                      }}
                    />
                    {point.photo ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void removeLototoPointPhoto(procedureId, point.id!)
                            .then((saved) => {
                              setDetail(saved);
                              setForm(fromProcedure(saved));
                            })
                            .catch((err) => setError(err instanceof ApiError ? err.message : "Photo could not be removed."))
                        }
                      >
                        Remove photo
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Save the procedure first to attach a photo.</p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Who may do this</h2>
        <div className="flex flex-wrap gap-3">
          {ROLE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={form.authorizedRoles.includes(opt.value)}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    authorizedRoles: e.target.checked
                      ? [...current.authorizedRoles, opt.value]
                      : current.authorizedRoles.filter((role) => role !== opt.value),
                  }))
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
