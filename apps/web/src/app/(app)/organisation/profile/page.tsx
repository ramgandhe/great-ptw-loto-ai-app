"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { organisationsApi } from "@/lib/organisation/api";
import type { Organisation } from "@/lib/organisation/types";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { Button } from "@/components/ui/button";

export default function OrganisationProfilePage() {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [form, setForm] = useState({ name: "", legalName: "", registrationNumber: "" });
  const [error, setError] = useState<string | null>(null);
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
    try {
      const payload = {
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
      };
      const updated = org
        ? await organisationsApi.update(org.id, payload)
        : await organisationsApi.create(payload);
      setOrg(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Organisation profile</h1>
          <p className="text-sm text-muted-foreground">Register and manage tenant organisation details.</p>
        </div>
        <Link href="/organisation">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {org ? (
        <div className="flex items-center gap-3">
          <OrgStatusBadge status={org.status} />
          <span className="text-sm text-muted-foreground">ID {org.id.slice(0, 8)}</span>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <form onSubmit={handleSave} className="grid max-w-xl gap-4 rounded-lg border border-border bg-card p-4">
          {(["name", "legalName", "registrationNumber"] as const).map((key) => (
            <label key={key} className="grid gap-1.5 text-sm">
              <span className="font-medium capitalize">{key.replace(/([A-Z])/g, " $1")}{key === "name" ? " *" : ""}</span>
              <input
                required={key === "name"}
                value={form[key]}
                className="h-9 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : org ? "Update organisation" : "Register organisation"}
          </Button>
        </form>
      )}
    </main>
  );
}
