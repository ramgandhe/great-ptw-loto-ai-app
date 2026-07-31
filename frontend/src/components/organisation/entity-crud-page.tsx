"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  approvalWorkflowsApi,
  departmentsApi,
  locationsApi,
  machineryApi,
  notificationPreferencesApi,
  permitTemplatesApi,
  plantsApi,
  ppeConfigurationsApi,
  safetyChecklistsApi,
  workstationsApi,
} from "@/lib/organisation/api";
import type { EntityField, OrgRecord } from "@/lib/organisation/types";
import { loadEntitySelectOptions, type EntitySelectResource } from "@/lib/form-options";
import { OrgStatusBadge } from "./org-status-badge";
import { Button } from "@/components/ui/button";

const entityApis = {
  plants: plantsApi,
  departments: departmentsApi,
  locations: locationsApi,
  workstations: workstationsApi,
  machinery: machineryApi,
  workflows: approvalWorkflowsApi,
  templates: permitTemplatesApi,
  checklists: safetyChecklistsApi,
  ppe: ppeConfigurationsApi,
  notifications: notificationPreferencesApi,
} as const;

export type OrganisationEntityResource = keyof typeof entityApis;

type EntityApi = (typeof entityApis)[OrganisationEntityResource];

type EntityCrudPageProps = {
  title: string;
  description: string;
  resource: OrganisationEntityResource;
  fields: EntityField[];
  nameField?: keyof OrgRecord;
};

function emptyForm(fields: EntityField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}

export function EntityCrudPage({
  title,
  description,
  resource,
  fields,
  nameField = "name",
}: EntityCrudPageProps) {
  const api = entityApis[resource] as EntityApi;
  const [items, setItems] = useState<OrgRecord[]>([]);
  const [form, setForm] = useState<Record<string, string>>(() => emptyForm(fields));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const selectResources = fields
    .map((field) => field.select)
    .filter((resource): resource is EntitySelectResource => Boolean(resource));
  const [selectOptions, setSelectOptions] = useState<
    Partial<Record<EntitySelectResource, { value: string; label: string }[]>>
  >({});

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

  useEffect(() => {
    if (selectResources.length === 0) {
      return;
    }
    loadEntitySelectOptions(selectResources)
      .then(setSelectOptions)
      .catch(() => setSelectOptions({}));
  }, [selectResources.join(",")]);

  function resetForm() {
    setForm(emptyForm(fields));
    setEditingId(null);
  }

  function startEdit(item: OrgRecord) {
    setEditingId(item.id);
    setForm(Object.fromEntries(fields.map((f) => [f.key, String(item[f.key as keyof OrgRecord] ?? "")])));
  }

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
            ) : field.select ? (
              <select
                required={field.required}
                value={form[field.key] ?? ""}
                className="h-9 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              >
                <option value="">Select {field.label.toLowerCase()}</option>
                {(selectOptions[field.select] ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
