"use client";
import { AppSelect } from "@/components/ui/select";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { organisationsApi } from "@/lib/organisation/api";
import type { Organisation } from "@/lib/organisation/types";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";

const TIME_ZONES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];

const FIELDS = [
  { key: "name", label: "Organisation name", hint: "Shown to everyone in the app and on printed permits.", required: true },
  { key: "legalName", label: "Legal name", hint: "As registered, for permit records and audits." },
  { key: "registrationNumber", label: "Registration number", hint: "Company or factory licence number (e.g. CIN)." },
] as const;

const OVERTIME_APPROVER_OPTIONS = [
  { value: "permit-approver", label: "HOD / permit approver (default)" },
  { value: "area-authority", label: "Area authority" },
  { value: "shift-in-charge", label: "Shift in-charge" },
] as const;

export default function OrganisationProfilePage() {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [form, setForm] = useState({
    name: "",
    legalName: "",
    registrationNumber: "",
    timezone: "UTC",
    maxMultiDayValidityDays: "7",
    operationalDayCutoff: "16:30",
    overtimeApproverRole: "permit-approver" as Organisation["overtimeApproverRole"],
  });
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    organisationsApi
      .list()
      .then((records) => {
        const first = records[0] ?? null;
        setOrg(first);
        if (first) {
          setForm({
            name: first.name ?? "",
            legalName: first.legalName ?? "",
            registrationNumber: first.registrationNumber ?? "",
            timezone: first.timezone ?? "UTC",
            maxMultiDayValidityDays: String(first.maxMultiDayValidityDays ?? 7),
            operationalDayCutoff: first.operationalDayCutoff ?? "16:30",
            overtimeApproverRole: first.overtimeApproverRole ?? "permit-approver",
          });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load organisation"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!org?.hasLogo) {
      setLogoUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    organisationsApi
      .logo(org.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLogoUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setLogoUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [org?.id, org?.hasLogo, org?.logoFileName]);

  async function handleLogo(file: File | undefined) {
    if (!org || !file) return;
    setLogoBusy(true);
    setError(null);
    try {
      setOrg(await organisationsApi.uploadLogo(org.id, file));
      setSavedMessage("Saved organisation logo.");
      toast("Saved organisation logo.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Logo upload failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleRemoveLogo() {
    if (!org) return;
    setLogoBusy(true);
    setError(null);
    try {
      setOrg(await organisationsApi.removeLogo(org.id));
      setSavedMessage("Removed organisation logo.");
      toast("Removed organisation logo.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Logo removal failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const maxDays = Number.parseInt(form.maxMultiDayValidityDays, 10);
      if (org && (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 365)) {
        setError("Max multi-day validity must be a whole number from 1 to 365.");
        return;
      }
      if (org && !/^([01]?\d|2[0-3]):([0-5]\d)$/.test(form.operationalDayCutoff.trim())) {
        setError("Operational day cut-off must be HH:mm (24-hour), for example 16:30.");
        return;
      }
      const payload = {
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
      };
      // Time zone and MDP settings can only be set once the organisation exists.
      const updated = org
        ? await organisationsApi.update(org.id, {
            ...payload,
            timezone: form.timezone,
            maxMultiDayValidityDays: maxDays,
            operationalDayCutoff: form.operationalDayCutoff.trim(),
            overtimeApproverRole: form.overtimeApproverRole,
          })
        : await organisationsApi.create(payload);
      setOrg(updated);
      const msg = org ? "Organisation profile saved" : "Registered organisation.";
      setSavedMessage(msg);
      toast(msg);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Save failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Organisation profile"
        description="Tenant name is set when the organisation is invited. You can change it here."
      />

      {org ? (
        <div className="flex items-center gap-3">
          <OrgStatusBadge status={org.status} />
          {org.ownerEmail ? <span className="text-sm text-muted-foreground">Owner {org.ownerEmail}</span> : null}
        </div>
      ) : null}

      {savedMessage ? (
        <p role="status" className="text-sm font-medium text-(--status-success)">
          {savedMessage}
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {org ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-lg border border-border bg-muted">
            {logoUrl ? (
              // The tenant logo is an uploaded image, not a static asset.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="px-2 text-center text-[11px] text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="grid gap-2">
            <div>
              <h2 className="text-sm font-medium">Report logo</h2>
              <p className="text-xs text-muted-foreground">PNG, JPEG or WebP, up to 2 MB. Printed on the first page of a permit report.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={logoBusy ? "pointer-events-none opacity-60" : ""}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={logoBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void handleLogo(file);
                  }}
                />
                <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm font-medium">
                  {logoBusy ? "Saving logo…" : org.hasLogo ? "Replace logo" : "Upload logo"}
                </span>
              </label>
              {org.hasLogo ? (
                <Button type="button" variant="ghost" disabled={logoBusy} onClick={() => void handleRemoveLogo()}>
                  Remove logo
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="grid content-start gap-1.5 text-sm">
              <span className="font-medium">
                {field.label}
                {"required" in field && field.required ? <span className="text-destructive"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
              </span>
              <input
                required={"required" in field}
                value={form[field.key]}
                className={FIELD_CLASS}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
              <span className="text-xs text-muted-foreground">{field.hint}</span>
            </label>
          ))}
          {org ? (
            <>
              <label className="grid content-start gap-1.5 text-sm">
                <span className="font-medium">Time zone</span>
                <AppSelect
                  value={form.timezone}
                  className={FIELD_CLASS}
                  onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                >
                  {TIME_ZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </AppSelect>
                <span className="text-xs text-muted-foreground">Used for permit validity windows, multi-day days and reports.</span>
              </label>
              <div className="sm:col-span-2 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <p className="sm:col-span-2 text-sm font-medium">Multi-day permit settings</p>
                <label className="grid content-start gap-1.5 text-sm">
                  <span className="font-medium">Max multi-day validity (days)</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={form.maxMultiDayValidityDays}
                    className={FIELD_CLASS}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxMultiDayValidityDays: e.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">From planned start. Beyond this, use renewal instead of extension. Default 7.</span>
                </label>
                <label className="grid content-start gap-1.5 text-sm">
                  <span className="font-medium">Operational day cut-off</span>
                  <input
                    type="time"
                    required
                    value={form.operationalDayCutoff}
                    className={FIELD_CLASS}
                    onChange={(e) => setForm((prev) => ({ ...prev, operationalDayCutoff: e.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">Same-day work past this time needs overtime approval. Default 16:30.</span>
                </label>
                <label className="grid content-start gap-1.5 text-sm sm:col-span-2">
                  <span className="font-medium">Same-day overtime approver</span>
                  <AppSelect
                    value={form.overtimeApproverRole ?? "permit-approver"}
                    className={FIELD_CLASS}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        overtimeApproverRole: e.target.value as Organisation["overtimeApproverRole"],
                      }))
                    }
                  >
                    {OVERTIME_APPROVER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </AppSelect>
                  <span className="text-xs text-muted-foreground">Default is HOD / permit approver. Can be routed to area or shift authority.</span>
                </label>
              </div>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : org ? "Save changes" : "Register organisation"}
            </Button>
          </div>
        </form>
      )}
    </AdminPage>
  );
}
