"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { agenciesApi, competenciesApi, contractorsApi, employeesApi } from "@/lib/workforce/api";
import type { CompetencyRecord, EntityField, WorkforceRecord } from "@/lib/workforce/types";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { Button } from "@/components/ui/button";

const workforceApis = {
  employees: employeesApi,
  contractors: contractorsApi,
  agencies: agenciesApi,
  competencies: competenciesApi,
  certifications: competenciesApi,
} as const;

export type WorkforceEntityResource = keyof typeof workforceApis;

type WorkforceItem = WorkforceRecord | CompetencyRecord;

function emptyForm(fields: EntityField[]) {
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}

export function WorkforceCrudPage({
  title,
  description,
  resource,
  fields,
}: {
  title: string;
  description: string;
  resource: WorkforceEntityResource;
  fields: EntityField[];
}) {
  const api = workforceApis[resource];
  const [items, setItems] = useState<WorkforceItem[]>([]);
  const [form, setForm] = useState(() => emptyForm(fields));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = Object.fromEntries(fields.map((f) => [f.key, form[f.key]?.trim() ?? ""]));
    try {
      if (editingId) {
        await api.update(editingId, payload);
      } else {
        await api.create(payload);
      }
      setForm(emptyForm(fields));
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="grid gap-1.5 text-sm">
            <span className="font-medium">{field.label}{field.required ? " *" : ""}</span>
            <input
              required={field.required}
              value={form[field.key] ?? ""}
              className="h-9 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
            />
          </label>
        ))}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editingId ? "Update" : "Create"}</Button>
        </div>
      </form>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <table className="min-w-full text-sm border border-border rounded-lg overflow-hidden">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3"><OrgStatusBadge status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
