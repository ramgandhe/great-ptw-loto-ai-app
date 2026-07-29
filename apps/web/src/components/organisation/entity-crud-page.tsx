"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import type { EntityField, OrgRecord } from "@/lib/organisation/types";
import { OrgStatusBadge } from "./org-status-badge";
import { Button } from "@/components/ui/button";

type EntityApi<T extends OrgRecord> = {
  list: () => Promise<T[]>;
  create: (payload: Partial<T>) => Promise<T>;
  update: (id: string, payload: Partial<T>) => Promise<T>;
  archive: (id: string) => Promise<void>;
};

type EntityCrudPageProps<T extends OrgRecord> = {
  title: string;
  description: string;
  api: EntityApi<T>;
  fields: EntityField[];
  nameField?: keyof T;
};

function emptyForm(fields: EntityField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}

export function EntityCrudPage<T extends OrgRecord>({
  title,
  description,
  api,
  fields,
  nameField = "name" as keyof T,
}: EntityCrudPageProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [form, setForm] = useState<Record<string, string>>(() => emptyForm(fields));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load records"))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm(emptyForm(fields));
    setEditingId(null);
  }

  function startEdit(item: T) {
    setEditingId(item.id);
    setForm(Object.fromEntries(fields.map((f) => [f.key, String(item[f.key as keyof T] ?? "")])));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = Object.fromEntries(fields.map((f) => [f.key, form[f.key]?.trim() ?? ""]));

    try {
      if (editingId) {
        await api.update(editingId, payload as Partial<T>);
      } else {
        await api.create(payload as Partial<T>);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(id: string) {
    if (!window.confirm("Archive this record?")) {
      return;
    }
    setError(null);
    try {
      await api.archive(id);
      if (editingId === id) {
        resetForm();
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Archive failed");
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">
          {editingId ? "Edit record" : "Create record"}
        </h2>
        {fields.map((field) => (
          <label key={field.key} className="grid gap-1.5 text-sm sm:col-span-1">
            <span className="font-medium">
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.multiline ? (
              <textarea
                required={field.required}
                rows={3}
                value={form[field.key] ?? ""}
                className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            ) : (
              <input
                required={field.required}
                value={form[field.key] ?? ""}
                className="h-9 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : editingId ? "Update" : "Create"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No records found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3">{String(item[nameField] ?? "—")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.code ?? "—"}</td>
                  <td className="px-4 py-3">
                    <OrgStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button type="button" className="text-primary hover:underline" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-destructive hover:underline"
                        onClick={() => void handleArchive(item.id)}
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
