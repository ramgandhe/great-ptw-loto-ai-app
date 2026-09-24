"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { agenciesApi, competenciesApi, contractorsApi, employeesApi } from "@/lib/workforce/api";
import type { CompetencyRecord, EntityField, WorkforceRecord } from "@/lib/workforce/types";
import { loadEntitySelectOptions, type EntitySelectResource } from "@/lib/form-options";
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
  const [createdLogin, setCreatedLogin] = useState<{
    temporaryPassword?: string | null;
    loginCreated?: boolean;
    email?: string;
  } | null>(null);
  const selectResources = fields
    .map((field) => field.select)
    .filter((resource): resource is EntitySelectResource => Boolean(resource));
  const [selectOptions, setSelectOptions] = useState<
    Partial<Record<EntitySelectResource, { value: string; label: string }[]>>
  >({});

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

  useEffect(() => {
    if (selectResources.length === 0) {
      return;
    }
    loadEntitySelectOptions(selectResources)
      .then(setSelectOptions)
      .catch(() => setSelectOptions({}));
  }, [selectResources.join(",")]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = Object.fromEntries(fields.map((f) => [f.key, form[f.key]?.trim() ?? ""]));
    try {
      if (editingId) {
        await api.update(editingId, payload);
        setCreatedLogin(null);
      } else {
        const created = await api.create(payload);
        setCreatedLogin({
          temporaryPassword: (created as { temporaryPassword?: string }).temporaryPassword,
          loginCreated: (created as { loginCreated?: boolean }).loginCreated,
          email: payload.email,
        });
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
            {field.select ? (
              <select
                required={field.required}
                value={form[field.key] ?? ""}
                className="h-9 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
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
                type={field.key === "email" ? "email" : "text"}
                value={form[field.key] ?? ""}
                className="h-9 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editingId ? "Update" : "Create"}</Button>
        </div>
      </form>
      {createdLogin?.temporaryPassword ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">Login created for {createdLogin.email}</p>
          <p className="mt-1 text-muted-foreground">
            Copy this temporary password now. They must change it on first sign-in.
          </p>
          <p className="mt-2 font-mono">{createdLogin.temporaryPassword}</p>
        </div>
      ) : createdLogin?.loginCreated === false ? (
        <p className="text-sm text-muted-foreground">
          This email already has a platform login. They were added to the workforce and emailed.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <table className="min-w-full text-sm border border-border rounded-lg overflow-hidden">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              {resource !== "competencies" && resource !== "certifications" ? (
                <th className="px-4 py-3">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{"email" in item ? item.email ?? "—" : "—"}</td>
                <td className="px-4 py-3"><OrgStatusBadge status={item.status} /></td>
                {resource !== "competencies" && resource !== "certifications" ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(item.id);
                          setForm(Object.fromEntries(fields.map((field) => [field.key, String((item as Record<string, unknown>)[field.key] ?? "")])));
                        }}
                      >
                        Edit
                      </Button>
                      {item.status === "disabled" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!window.confirm(`Reactivate ${item.name}?`)) return;
                            void (api as typeof employeesApi).reactivate(item.id).then(load).catch((err) => setError(err instanceof ApiError ? err.message : "Reactivate failed"));
                          }}
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!window.confirm(`Deactivate ${item.name}? They stay on this list but cannot sign in.`)) return;
                            void (api as typeof employeesApi).deactivate(item.id).then(load).catch((err) => setError(err instanceof ApiError ? err.message : "Deactivate failed"));
                          }}
                        >
                          Deactivate
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (!window.confirm(`Delete ${item.name}? This removes the row and their login.`)) return;
                          void api.archive(item.id).then(load).catch((err) => setError(err instanceof ApiError ? err.message : "Delete failed"));
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
