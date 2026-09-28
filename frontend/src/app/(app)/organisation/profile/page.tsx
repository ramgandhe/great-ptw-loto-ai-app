"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { organisationsApi } from "@/lib/organisation/api";
import type { Organisation } from "@/lib/organisation/types";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";

const TIME_ZONES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];

const FIELDS = [
  { key: "name", label: "Organisation name", hint: "Shown to everyone in the app and on printed permits.", required: true },
  { key: "legalName", label: "Legal name", hint: "As registered, for permit records and audits." },
  { key: "registrationNumber", label: "Registration number", hint: "Company or factory licence number (e.g. CIN)." },
] as const;

export default function OrganisationProfilePage() {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [form, setForm] = useState({ name: "", legalName: "", registrationNumber: "", timezone: "UTC" });
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
          });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load organisation"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
      };
      // Time zone can only be set once the organisation exists.
      const updated = org
        ? await organisationsApi.update(org.id, { ...payload, timezone: form.timezone })
        : await organisationsApi.create(payload);
      setOrg(updated);
      setSavedMessage(org ? "Saved organisation details." : "Registered organisation.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="grid content-start gap-1.5 text-sm">
              <span className="font-medium">
                {field.label}
                {"required" in field ? "" : <span className="font-normal text-muted-foreground"> (optional)</span>}
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
            <label className="grid content-start gap-1.5 text-sm">
              <span className="font-medium">Time zone</span>
              <select
                value={form.timezone}
                className={FIELD_CLASS}
                onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
              >
                {TIME_ZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">Used for permit validity windows and reports.</span>
            </label>
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
