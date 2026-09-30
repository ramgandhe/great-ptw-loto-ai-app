"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/ui/row-actions";
import { toast } from "@/components/ui/toast";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { OrgStatusBadge, stateOf } from "@/components/organisation/org-status-badge";
import { StringListField } from "@/components/organisation/string-list-field";
import { hazardsApi } from "@/lib/organisation/api";
import type { HazardRecord } from "@/lib/master-data/api";

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const emptyForm = {
  name: "",
  code: "",
  category: "",
  description: "",
  severity: "medium",
  consequences: [""],
  controls: [""],
};

export default function HazardsPage() {
  const [items, setItems] = useState<HazardRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function load() {
    return hazardsApi
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load hazards."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(item: HazardRecord) {
    setForm({
      name: item.name,
      code: item.code ?? "",
      category: item.category ?? "",
      description: item.description ?? "",
      severity: item.severity ?? "medium",
      consequences: item.consequences?.length ? item.consequences : [""],
      controls: item.controls?.length ? item.controls : [""],
    });
    setEditingId(item.id);
    setFormOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      category: form.category.trim(),
      description: form.description.trim() || undefined,
      severity: form.severity,
      consequences: form.consequences,
      controls: form.controls,
    };
    try {
      if (editingId) {
        await hazardsApi.update(editingId, payload);
        toast("Hazard saved");
      } else {
        await hazardsApi.create(payload);
        toast("Hazard added");
      }
      resetForm();
      setLoading(true);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the hazard.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(item: HazardRecord, on: boolean) {
    if (!on && !window.confirm(`Deactivate ${item.name}? It stays listed but is no longer offered on new permits.`)) {
      return;
    }
    try {
      await hazardsApi.update(item.id, { isActive: on });
      toast(`${item.name} ${on ? "activated" : "deactivated"}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the hazard.");
    }
  }

  async function handleArchive(item: HazardRecord) {
    if (!window.confirm(`Delete ${item.name}? Permits that used it keep their record.`)) {
      return;
    }
    try {
      await hazardsApi.archive(item.id);
      toast(`${item.name} deleted`);
      if (editingId === item.id) {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the hazard.");
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Hazard configuration"
        description="Defaults for each hazard. Permits copy extras only; this catalogue stays unchanged by executors."
        action={
          !formOpen ? (
            <Button type="button" size="lg" onClick={openCreate}>
              <Plus aria-hidden />
              Add hazard
            </Button>
          ) : null
        }
      />

      {formOpen ? (
        <form
          ref={formRef}
          onSubmit={(event) => void handleSubmit(event)}
          className="reveal-in grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
        >
          <h2 className="font-semibold sm:col-span-2">{editingId ? `Edit ${form.name || "hazard"}` : "New hazard"}</h2>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <input required autoFocus value={form.name} className={FIELD_CLASS} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Code</span>
            <input required value={form.code} className={`${FIELD_CLASS} font-mono`} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Category</span>
            <input required value={form.category} className={FIELD_CLASS} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Risk / severity</span>
            <select required value={form.severity} className={FIELD_CLASS} onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))}>
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              value={form.description}
              rows={3}
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>
          <div className="sm:col-span-2">
            <StringListField
              label="Potential consequences"
              values={form.consequences}
              addLabel="Add consequence"
              onChange={(consequences) => setForm((prev) => ({ ...prev, consequences }))}
            />
          </div>
          <div className="sm:col-span-2">
            <StringListField
              label="Controls"
              values={form.controls}
              addLabel="Add control"
              onChange={(controls) => setForm((prev) => ({ ...prev, controls }))}
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add hazard"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">No hazards yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add hazards so executors can attach them to permits.</p>
        </div>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5">Hazard</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Severity</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border first:border-t-0">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                  <td className="px-4 py-3">{item.category || "—"}</td>
                  <td className="px-4 py-3 capitalize">{item.severity ?? "medium"}</td>
                  <td className="px-4 py-3">
                    <OrgStatusBadge status={stateOf(item)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => openEdit(item) },
                        item.isActive === false
                          ? { label: "Activate", onClick: () => void handleSetActive(item, true) }
                          : { label: "Deactivate", onClick: () => void handleSetActive(item, false) },
                        { label: "Delete", onClick: () => void handleArchive(item), danger: true },
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
