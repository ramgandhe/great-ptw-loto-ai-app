"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { gasTestingApi, type GasTestingRecord } from "@/lib/master-data/api";
import { workstationsApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { formatOrgOptionLabel } from "@/lib/form-options";
import { Button } from "@/components/ui/button";

const emptyForm = {
  workstationId: "",
  parameter: "",
  unit: "",
  minimum: "",
  maximum: "",
};

export default function GasTestingConfigPage() {
  const [items, setItems] = useState<GasTestingRecord[]>([]);
  const [workstations, setWorkstations] = useState<OrgRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    return Promise.all([gasTestingApi.list(), workstationsApi.list()])
      .then(([rows, workstationRows]) => {
        setItems(rows);
        setWorkstations(workstationRows);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load gas testing configuration"),
      );
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function startEdit(item: GasTestingRecord) {
    setEditingId(item.id);
    setForm({
      workstationId: item.workstationId,
      parameter: item.parameter,
      unit: item.unit,
      minimum: String(item.minimum),
      maximum: String(item.maximum),
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const minimum = Number(form.minimum);
    const maximum = Number(form.maximum);
    if (!form.workstationId || !form.parameter.trim() || !form.unit.trim()) {
      setError("Workstation, parameter, and unit are required.");
      return;
    }
    if (Number.isNaN(minimum) || Number.isNaN(maximum)) {
      setError("Minimum and maximum must be numbers.");
      return;
    }
    if (minimum >= maximum) {
      setError("Minimum must be less than maximum.");
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      workstationId: form.workstationId,
      parameter: form.parameter.trim(),
      unit: form.unit.trim(),
      minimum,
      maximum,
    };
    try {
      if (editingId) {
        await gasTestingApi.update(editingId, payload);
      } else {
        await gasTestingApi.create(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save gas testing item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this gas testing item?");
    if (!confirmed) {
      return;
    }
    setError(null);
    try {
      await gasTestingApi.remove(id);
      if (editingId === id) {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete gas testing item");
    }
  }

  function workstationLabel(id: string) {
    const workstation = workstations.find((item) => item.id === id);
    return workstation ? formatOrgOptionLabel(workstation) : id;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Gas Testing configuration</h1>
        <p className="text-sm text-muted-foreground">
          Configure gas testing parameters and criteria by workstation. Permits can select these
          items when gas testing is required.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid max-w-xl gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{editingId ? "Edit item" : "Add item"}</h2>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Workstation *</span>
          <select
            required
            value={form.workstationId}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, workstationId: e.target.value }))}
          >
            <option value="">Select workstation</option>
            {workstations.map((item) => (
              <option key={item.id} value={item.id}>
                {formatOrgOptionLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Parameter *</span>
          <input
            required
            value={form.parameter}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, parameter: e.target.value }))}
            placeholder="Oxygen"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Unit *</span>
          <input
            required
            value={form.unit}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
            placeholder="%"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Minimum *</span>
            <input
              required
              type="number"
              step="any"
              value={form.minimum}
              className="h-9 rounded-lg border border-border bg-background px-3"
              onChange={(e) => setForm((prev) => ({ ...prev, minimum: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Maximum *</span>
            <input
              required
              type="number"
              step="any"
              value={form.maximum}
              className="h-9 rounded-lg border border-border bg-background px-3"
              onChange={(e) => setForm((prev) => ({ ...prev, maximum: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving || workstations.length === 0}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Add item"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
        {workstations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add workstations first under Organisation → Workstations.</p>
        ) : null}
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Gas Testing Session</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No gas testing items yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">Workstation</th>
                  <th className="px-3 py-2 font-medium">Parameter</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Minimum</th>
                  <th className="px-3 py-2 font-medium">Maximum</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{workstationLabel(item.workstationId)}</td>
                    <td className="px-3 py-2">{item.parameter}</td>
                    <td className="px-3 py-2">{item.unit}</td>
                    <td className="px-3 py-2">{item.minimum}</td>
                    <td className="px-3 py-2">{item.maximum}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)}>
                          Edit
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleDelete(item.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
