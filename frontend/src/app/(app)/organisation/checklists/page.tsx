"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  checklistsApi,
  type SafetyChecklistBundle,
} from "@/lib/master-data/checklists";

type ItemDraft = { description: string; isMandatory: boolean };

const emptyForm = {
  name: "",
  code: "",
  description: "",
  items: [{ description: "", isMandatory: true }] as ItemDraft[],
};

export default function ChecklistsPage() {
  const [items, setItems] = useState<SafetyChecklistBundle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    return checklistsApi
      .list()
      .then(setItems)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load safety checklists"),
      );
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function startEdit(bundle: SafetyChecklistBundle) {
    setEditingId(bundle.checklist.id);
    setForm({
      name: bundle.checklist.name,
      code: bundle.checklist.code,
      description: bundle.checklist.description ?? "",
      items:
        bundle.items.length > 0
          ? bundle.items.map((item) => ({
              description: item.description,
              isMandatory: item.isMandatory,
            }))
          : [{ description: "", isMandatory: true }],
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function setItem(index: number, patch: Partial<ItemDraft>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: "", isMandatory: false }],
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.length === 1 ? prev.items : prev.items.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const checklistItems = form.items
      .map((item) => ({
        description: item.description.trim(),
        isMandatory: item.isMandatory,
      }))
      .filter((item) => item.description.length > 0);

    if (!form.name.trim() || !form.code.trim()) {
      setError("Name and code are required.");
      return;
    }
    if (checklistItems.length === 0) {
      setError("Add at least one checklist item.");
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim() || undefined,
      items: checklistItems,
    };
    try {
      if (editingId) {
        await checklistsApi.update(editingId, payload);
      } else {
        await checklistsApi.create(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save checklist");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    const confirmed = window.confirm("Archive this checklist?");
    if (!confirmed) {
      return;
    }
    setError(null);
    try {
      await checklistsApi.archive(id);
      if (editingId === id) {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to archive checklist");
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Safety checklists</h1>
        <p className="text-sm text-muted-foreground">
          Configure reusable checklists and their items. Permits can attach published checklists.
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

      <form onSubmit={handleSubmit} className="grid max-w-2xl gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">{editingId ? "Edit checklist" : "Add checklist"}</h2>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Name *</span>
          <input
            required
            value={form.name}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Code *</span>
          <input
            required
            value={form.code}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            value={form.description}
            className="min-h-20 rounded-lg border border-border bg-background px-3 py-2"
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </label>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Checklist items *</h3>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              Add item
            </Button>
          </div>
          {form.items.map((item, index) => (
            <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <input
                required
                value={item.description}
                placeholder={`Item ${index + 1}`}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                onChange={(e) => setItem(index, { description: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.isMandatory}
                  onChange={(e) => setItem(index, { isMandatory: e.target.checked })}
                />
                Mandatory
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={form.items.length === 1}
                onClick={() => removeItem(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Add checklist"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Existing checklists</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checklists yet.</p>
        ) : (
          <div className="grid gap-3">
            {items.map((bundle) => (
              <div key={bundle.checklist.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{bundle.checklist.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {bundle.checklist.code}
                      {bundle.checklist.status ? ` · ${bundle.checklist.status}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(bundle)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleArchive(bundle.checklist.id)}
                    >
                      Archive
                    </Button>
                  </div>
                </div>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                  {bundle.items.map((item) => (
                    <li key={item.id}>
                      {item.description}
                      {item.isMandatory ? (
                        <span className="ml-2 text-muted-foreground">(mandatory)</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
