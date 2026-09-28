"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { gasTestingApi, type GasTestingRecord } from "@/lib/master-data/api";
import { workstationsApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { formatOrgOptionLabel } from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";

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
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const addAnother = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

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

  function openForm(item?: GasTestingRecord) {
    setEditingId(item?.id ?? null);
    setForm(
      item
        ? {
            workstationId: item.workstationId,
            parameter: item.parameter,
            unit: item.unit,
            minimum: String(item.minimum),
            maximum: String(item.maximum),
          }
        : emptyForm,
    );
    setError(null);
    setSavedMessage(null);
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
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
      setSavedMessage(`${editingId ? "Saved" : "Added"} ${payload.parameter}.`);
      if (addAnother.current && !editingId) {
        // Keep the workstation so several parameters for the same place can be added in a row.
        setForm({ ...emptyForm, workstationId: form.workstationId });
      } else {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save gas testing item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this gas testing item?")) {
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
    return workstation ? formatOrgOptionLabel(workstation) : "Unknown workstation";
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Gas testing"
        description="Gas testing parameters and safe limits by workstation. Permits pick these when gas testing is required."
        action={
          !formOpen ? (
            <Button type="button" size="lg" onClick={() => openForm()} disabled={!loading && workstations.length === 0}>
              <Plus aria-hidden />
              Add parameter
            </Button>
          ) : null
        }
      />

      {!loading && workstations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a{" "}
          <Link href="/organisation/workstations" className="text-primary hover:underline">
            workstation
          </Link>{" "}
          first; gas testing limits are set per workstation.
        </p>
      ) : null}

      {savedMessage ? (
        <p role="status" className="text-sm font-medium text-(--status-success)">
          {savedMessage}
        </p>
      ) : null}

      {formOpen ? (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="reveal-in grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
        >
          <h2 className="font-semibold sm:col-span-2">{editingId ? `Edit ${form.parameter || "parameter"}` : "New parameter"}</h2>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Workstation</span>
            <select
              required
              value={form.workstationId}
              className={FIELD_CLASS}
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
            <span className="font-medium">Parameter</span>
            <input
              required
              value={form.parameter}
              className={FIELD_CLASS}
              onChange={(e) => setForm((prev) => ({ ...prev, parameter: e.target.value }))}
              placeholder="Oxygen"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Unit</span>
            <input
              required
              value={form.unit}
              className={FIELD_CLASS}
              onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
              placeholder="%"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Minimum</span>
            <input
              required
              type="number"
              step="any"
              value={form.minimum}
              className={FIELD_CLASS}
              onChange={(e) => setForm((prev) => ({ ...prev, minimum: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Maximum</span>
            <input
              required
              type="number"
              step="any"
              value={form.maximum}
              className={FIELD_CLASS}
              onChange={(e) => setForm((prev) => ({ ...prev, maximum: e.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving} onClick={() => (addAnother.current = false)}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add parameter"}
            </Button>
            {!editingId ? (
              <Button type="submit" variant="outline" disabled={saving} onClick={() => (addAnother.current = true)}>
                Add and add another
              </Button>
            ) : null}
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
          <p className="font-medium">No gas testing parameters yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the first parameter so permits can record gas readings.</p>
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Parameter</th>
                <th className="px-4 py-2.5 font-medium">Workstation</th>
                <th className="px-4 py-2.5 font-medium">Safe range</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`cursor-pointer border-t border-border first:border-t-0 hover:bg-muted/40 ${editingId === item.id ? "bg-muted/60" : ""}`}
                  onClick={() => openForm(item)}
                >
                  <td className="px-4 py-3 font-medium">{item.parameter}</td>
                  <td className="px-4 py-3 text-muted-foreground">{workstationLabel(item.workstationId)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {item.minimum} to {item.maximum} {item.unit}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-3">
                      <button type="button" className="text-primary hover:underline" onClick={() => openForm(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive hover:underline"
                        onClick={() => void handleDelete(item.id)}
                      >
                        Delete
                      </button>
                    </div>
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
