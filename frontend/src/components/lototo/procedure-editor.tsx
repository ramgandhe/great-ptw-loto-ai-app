"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { LOTOTO_LIBRARY_WRITE_ROLES } from "@/lib/auth/roles";
import { ENERGY_SOURCE_OPTIONS } from "@/lib/lototo/form-options";
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
import type {
  LototoLockoutPoint,
  LototoProcedure,
  LototoProcedurePayload,
  LototoSequenceStep,
} from "@/lib/lototo/types";
import { machineryApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const ROLE_OPTIONS = [
  { value: "operator", label: "Job executor" },
  { value: "safety-officer", label: "Safety officer" },
  { value: "hod", label: "Head of Department" },
  { value: "job-issuer", label: "Job issuer" },
];

function emptyPoint(order: number): LototoLockoutPoint {
  return {
    sortOrder: order,
    pointCode: "",
    energyType: "electrical",
    magnitude: "",
    locationText: "",
    action: "",
    device: "",
    verificationMethod: "",
  };
}

function emptyStep(phase: "apply" | "remove", order: number): LototoSequenceStep {
  return { phase, sequenceOrder: order, title: "", description: "" };
}

type FormState = {
  machineryId: string;
  workstationId: string;
  code: string;
  title: string;
  facility: string;
  locationText: string;
  purpose: string;
  scope: string;
  authorization: string;
  enforcement: string;
  description: string;
  note: string;
  lockoutPoints: LototoLockoutPoint[];
  applySteps: LototoSequenceStep[];
  removeSteps: LototoSequenceStep[];
  authorizedRoles: string[];
};

function fromProcedure(detail: LototoProcedure): FormState {
  const version = detail.draftVersion ?? detail.publishedVersion;
  return {
    machineryId: detail.machineryId,
    workstationId: detail.workstationId ?? "",
    code: detail.code,
    title: detail.title,
    facility: version?.facility ?? "",
    locationText: version?.locationText ?? "",
    purpose: version?.purpose ?? "",
    scope: version?.scope ?? "",
    authorization: version?.authorization ?? "",
    enforcement: version?.enforcement ?? "",
    description: version?.description ?? "",
    note: version?.note ?? "",
    lockoutPoints: version?.lockoutPoints.length ? version.lockoutPoints : [emptyPoint(1)],
    applySteps: (version?.sequenceSteps.filter((s) => s.phase === "apply").length
      ? version.sequenceSteps.filter((s) => s.phase === "apply")
      : [emptyStep("apply", 1)]),
    removeSteps: (version?.sequenceSteps.filter((s) => s.phase === "remove").length
      ? version.sequenceSteps.filter((s) => s.phase === "remove")
      : [emptyStep("remove", 1)]),
    authorizedRoles: version?.authorizedRoles ?? [],
  };
}

function payloadOf(form: FormState): LototoProcedurePayload {
  return {
    machineryId: form.machineryId,
    workstationId: form.workstationId || undefined,
    code: form.code.trim(),
    title: form.title.trim(),
    facility: form.facility.trim() || undefined,
    locationText: form.locationText.trim() || undefined,
    purpose: form.purpose.trim() || undefined,
    scope: form.scope.trim() || undefined,
    authorization: form.authorization.trim() || undefined,
    enforcement: form.enforcement.trim() || undefined,
    description: form.description.trim() || undefined,
    note: form.note.trim() || undefined,
    lockoutPoints: form.lockoutPoints
      .filter((p) => p.pointCode.trim())
      .map((p, i) => ({
        sortOrder: i + 1,
        pointCode: p.pointCode.trim(),
        energyType: p.energyType,
        magnitude: p.magnitude?.trim() || undefined,
        locationText: p.locationText?.trim() || undefined,
        action: p.action?.trim() || undefined,
        device: p.device?.trim() || undefined,
        verificationMethod: p.verificationMethod?.trim() || undefined,
      })),
    sequenceSteps: [
      ...form.applySteps
        .filter((s) => s.title.trim())
        .map((s, i) => ({
          phase: "apply" as const,
          sequenceOrder: i + 1,
          title: s.title.trim(),
          description: s.description?.trim() || undefined,
        })),
      ...form.removeSteps
        .filter((s) => s.title.trim())
        .map((s, i) => ({
          phase: "remove" as const,
          sequenceOrder: i + 1,
          title: s.title.trim(),
          description: s.description?.trim() || undefined,
        })),
    ],
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
  const { roles } = useAuthProfile();
  const canWrite = hasAnyRole(roles, LOTOTO_LIBRARY_WRITE_ROLES);
  const [machinery, setMachinery] = useState<OrgRecord[]>([]);
  const [detail, setDetail] = useState<LototoProcedure | null>(null);
  const [form, setForm] = useState<FormState>({
    machineryId: initialMachineryId ?? "",
    workstationId: "",
    code: "",
    title: "",
    facility: "",
    locationText: "",
    purpose: "",
    scope: "",
    authorization: "",
    enforcement: "",
    description: "",
    note: "",
    lockoutPoints: [emptyPoint(1)],
    applySteps: [emptyStep("apply", 1)],
    removeSteps: [emptyStep("remove", 1)],
    authorizedRoles: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(procedureId));
  const [saving, setSaving] = useState(false);

  const locked = Boolean(detail && !detail.draftVersion && (detail.status === "published" || detail.status === "inactive"));
  const readOnly = !canWrite || locked;

  useEffect(() => {
    machineryApi.list().then(setMachinery).catch(() => setMachinery([]));
  }, []);

  useEffect(() => {
    if (!procedureId) {
      return;
    }
    getLototoProcedure(procedureId)
      .then((row) => {
        setDetail(row);
        setForm(fromProcedure(row));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Procedure could not be loaded."))
      .finally(() => setLoading(false));
  }, [procedureId]);

  const selectedMachine = useMemo(
    () => machinery.find((item) => item.id === form.machineryId),
    [machinery, form.machineryId],
  );

  function setPoint(index: number, patch: Partial<LototoLockoutPoint>) {
    setForm((current) => ({
      ...current,
      lockoutPoints: current.lockoutPoints.map((point, i) => (i === index ? { ...point, ...patch } : point)),
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = payloadOf(form);
      const saved = procedureId
        ? await updateLototoProcedure(procedureId, body)
        : await createLototoProcedure(body);
      setDetail(saved);
      setForm(fromProcedure(saved));
      if (!procedureId) {
        router.replace(`/lototo/procedures/${saved.id}`);
      }
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
    if (!procedureId) {
      return;
    }
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
    if (!procedureId || !window.confirm("Deactivate this procedure? It will no longer be offered on new permits.")) {
      return;
    }
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
    if (!procedureId) {
      return;
    }
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
    if (!procedureId || !window.confirm("Delete this unused procedure?")) {
      return;
    }
    try {
      await deleteLototoProcedure(procedureId);
      router.push("/lototo");
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
        description="Reusable lockout procedure for a machine. Permits snapshot the published version."
        back={{ href: "/lototo", label: "LOTOTO procedures" }}
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              {detail?.status === "published" && locked ? (
                <Button type="button" onClick={() => void revise()} disabled={saving}>
                  New revision
                </Button>
              ) : detail?.status !== "inactive" ? (
                <>
                  <Button type="button" variant="outline" onClick={() => void save()} disabled={saving}>
                    Save draft
                  </Button>
                  <Button type="button" onClick={() => void publish()} disabled={saving}>
                    Publish
                  </Button>
                </>
              ) : null}
              {locked && detail?.status === "published" ? (
                <Button type="button" variant="outline" onClick={() => void deactivate()} disabled={saving}>
                  Deactivate
                </Button>
              ) : null}
              {detail?.status === "inactive" ? (
                <Button type="button" onClick={() => void reactivate()} disabled={saving}>
                  Reactivate
                </Button>
              ) : null}
              {procedureId && (detail?.status === "draft" || detail?.status === "inactive") ? (
                <Button type="button" variant="outline" onClick={() => void remove()}>
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {detail?.publishedVersion ? (
        <p className="text-sm text-muted-foreground">
          Published v{detail.publishedVersion.versionNumber}
          {detail.draftVersion ? ` · editing draft v${detail.draftVersion.versionNumber}` : ""}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Header</h2>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Procedure ID</span>
          <input className={FIELD} value={form.code} disabled={readOnly} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="A-1107-MXZ01" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input className={FIELD} value={form.title} disabled={readOnly} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Bucket Elevator lockout" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Machinery</span>
          <select
            className={FIELD}
            value={form.machineryId}
            disabled={readOnly}
            onChange={(e) => {
              const next = machinery.find((item) => item.id === e.target.value);
              setForm({ ...form, machineryId: e.target.value, workstationId: next?.workstationId ?? "" });
            }}
          >
            <option value="">Select machinery</option>
            {machinery.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.code ? ` (${item.code})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Facility</span>
          <input className={FIELD} value={form.facility} disabled={readOnly} onChange={(e) => setForm({ ...form, facility: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Location</span>
          <input className={FIELD} value={form.locationText} disabled={readOnly} onChange={(e) => setForm({ ...form, locationText: e.target.value })} placeholder={selectedMachine?.name} />
        </label>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <h2 className="text-sm font-semibold sm:col-span-2">Purpose and rules</h2>
        {(
          [
            ["purpose", "Purpose"],
            ["scope", "Scope"],
            ["authorization", "Authorization"],
            ["enforcement", "Enforcement"],
            ["description", "Description"],
            ["note", "Note"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="grid gap-1 text-sm sm:col-span-2">
            <span className="font-medium">{label}</span>
            <textarea
              className={`${FIELD} min-h-20`}
              disabled={readOnly}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Lockout points</h2>
          {readOnly ? null : (
            <Button type="button" variant="outline" size="sm" onClick={() => setForm((c) => ({ ...c, lockoutPoints: [...c.lockoutPoints, emptyPoint(c.lockoutPoints.length + 1)] }))}>
              <Plus className="size-4" /> Add point
            </Button>
          )}
        </div>
        {form.lockoutPoints.map((point, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
            <div className="flex items-center justify-between sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
              {readOnly ? null : (
                <button type="button" className="text-muted-foreground" aria-label="Remove point" onClick={() => setForm((c) => ({ ...c, lockoutPoints: c.lockoutPoints.filter((_, i) => i !== index) }))}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            <input className={FIELD} placeholder="Point ID (E-1)" disabled={readOnly} value={point.pointCode} onChange={(e) => setPoint(index, { pointCode: e.target.value })} />
            <select className={FIELD} disabled={readOnly} value={point.energyType} onChange={(e) => setPoint(index, { energyType: e.target.value })}>
              {ENERGY_SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input className={FIELD} placeholder="Magnitude (415 Volts)" disabled={readOnly} value={point.magnitude ?? ""} onChange={(e) => setPoint(index, { magnitude: e.target.value })} />
            <input className={FIELD} placeholder="Device" disabled={readOnly} value={point.device ?? ""} onChange={(e) => setPoint(index, { device: e.target.value })} />
            <input className={`${FIELD} sm:col-span-2`} placeholder="Location" disabled={readOnly} value={point.locationText ?? ""} onChange={(e) => setPoint(index, { locationText: e.target.value })} />
            <textarea className={`${FIELD} min-h-16 sm:col-span-2`} placeholder="Action" disabled={readOnly} value={point.action ?? ""} onChange={(e) => setPoint(index, { action: e.target.value })} />
            <input className={`${FIELD} sm:col-span-2`} placeholder="Verification method" disabled={readOnly} value={point.verificationMethod ?? ""} onChange={(e) => setPoint(index, { verificationMethod: e.target.value })} />
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
                      if (!file) {
                        return;
                      }
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
        ))}
      </section>

      {(["apply", "remove"] as const).map((phase) => {
        const key = phase === "apply" ? "applySteps" : "removeSteps";
        const steps = form[key];
        const title = phase === "apply" ? "Lockout application sequence" : "Lockout removal sequence";
        return (
          <section key={phase} className="grid gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{title}</h2>
              {readOnly ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((c) => ({
                      ...c,
                      [key]: [...c[key], emptyStep(phase, c[key].length + 1)],
                    }))
                  }
                >
                  <Plus className="size-4" /> Add step
                </Button>
              )}
            </div>
            {steps.map((step, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                <span className="pt-2 text-sm text-muted-foreground">{index + 1}</span>
                <input
                  className={FIELD}
                  placeholder="Step title"
                  disabled={readOnly}
                  value={step.title}
                  onChange={(e) =>
                    setForm((c) => ({
                      ...c,
                      [key]: c[key].map((row, i) => (i === index ? { ...row, title: e.target.value } : row)),
                    }))
                  }
                />
                {readOnly ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    className="text-muted-foreground"
                    aria-label="Remove step"
                    onClick={() => setForm((c) => ({ ...c, [key]: c[key].filter((_, i) => i !== index) }))}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
                <textarea
                  className={`${FIELD} min-h-16 sm:col-span-3`}
                  placeholder="Description (optional)"
                  disabled={readOnly}
                  value={step.description ?? ""}
                  onChange={(e) =>
                    setForm((c) => ({
                      ...c,
                      [key]: c[key].map((row, i) => (i === index ? { ...row, description: e.target.value } : row)),
                    }))
                  }
                />
              </div>
            ))}
          </section>
        );
      })}

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Authorized roles</h2>
        <div className="flex flex-wrap gap-3">
          {ROLE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={form.authorizedRoles.includes(opt.value)}
                onChange={(e) =>
                  setForm((c) => ({
                    ...c,
                    authorizedRoles: e.target.checked
                      ? [...c.authorizedRoles, opt.value]
                      : c.authorizedRoles.filter((role) => role !== opt.value),
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
