"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/ui/row-actions";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { OrgStatusBadge, stateOf } from "@/components/organisation/org-status-badge";
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
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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

  function openForm(bundle?: SafetyChecklistBundle) {
    setEditingId(bundle?.checklist.id ?? null);
    setForm(
      bundle
        ? {
            name: bundle.checklist.name,
            code: bundle.checklist.code,
            description: bundle.checklist.description ?? "",
            items:
              bundle.items.length > 0
                ? bundle.items.map((item) => ({ description: item.description, isMandatory: item.isMandatory }))
                : emptyForm.items,
          }
        : emptyForm,
    );
    setError(null);
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(false);
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
      toast(`${payload.name} ${editingId ? "saved" : "added"}`);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save checklist");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(bundle: SafetyChecklistBundle, on: boolean) {
    const name = bundle.checklist.name;
    if (!on && !window.confirm(`Deactivate ${name}? It stays on this list but cannot be attached to permits.`)) return;
    setError(null);
    try {
      await checklistsApi.update(bundle.checklist.id, { isActive: on });
      toast(`${name} ${on ? "activated" : "deactivated"}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `${on ? "Activate" : "Deactivate"} failed`);
    }
  }

  async function handleArchive(id: string) {
    const name = items.find((bundle) => bundle.checklist.id === id)?.checklist.name ?? "this checklist";
    if (!window.confirm(`Delete ${name}? It moves to the Deleted view; permits that used it keep their record.`)) {
      return;
    }
    setError(null);
    try {
      await checklistsApi.archive(id);
      toast(`${name} deleted`);
      if (editingId === id) {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to archive checklist");
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Safety checklists"
        description="Reusable checklists and their items. Permits can attach published checklists."
        action={
          !formOpen ? (
            <Button type="button" size="lg" onClick={() => openForm()}>
              <Plus aria-hidden />
              Add checklist
            </Button>
          ) : null
        }
      >
        <SegmentedToggle
          label="Show"
          value={view}
          onChange={(v) => setView(v as "active" | "archived")}
          options={[
            { value: "active", label: "Active", count: items.filter((b) => b.checklist.status !== "archived").length },
            { value: "archived", label: "Deleted", count: items.filter((b) => b.checklist.status === "archived").length },
          ]}
          className="self-start"
        />
      </AdminPageHeader>

      {formOpen ? (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="reveal-in grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
        >
          <h2 className="font-semibold sm:col-span-2">{editingId ? `Edit ${form.name || "checklist"}` : "New checklist"}</h2>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <input
              required
              autoFocus
              value={form.name}
              className={FIELD_CLASS}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Code</span>
            <input
              required
              value={form.code}
              className={`${FIELD_CLASS} font-mono`}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              value={form.description}
              rows={2}
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>

          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Checklist items</legend>
            {form.items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                <input
                  required
                  value={item.description}
                  aria-label={`Item ${index + 1}`}
                  placeholder={`Item ${index + 1}`}
                  className={`${FIELD_CLASS} text-sm`}
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
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={form.items.length === 1}
                  onClick={() => removeItem(index)}
                >
                  <X aria-hidden />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={addItem}>
              <Plus aria-hidden />
              Add item
            </Button>
          </fieldset>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add checklist"}
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
          <p className="font-medium">No safety checklists yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the first checklist so it can be attached to permits.</p>
        </div>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Items</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter((bundle) => (bundle.checklist.status === "archived") === (view === "archived"))
                .map((bundle) => {
                const archived = bundle.checklist.status === "archived";
                const mandatory = bundle.items.filter((item) => item.isMandatory).length;
                return (
                  <tr
                    key={bundle.checklist.id}
                    className={`cursor-pointer border-t border-border first:border-t-0 hover:bg-muted/40 ${editingId === bundle.checklist.id ? "bg-muted/60" : ""}`}
                    onClick={() => (archived ? undefined : openForm(bundle))}
                  >
                    <td className="px-4 py-3">
                      <span className="block font-medium">{bundle.checklist.name}</span>
                      {bundle.items.length > 0 ? (
                        <span className="block max-w-md truncate text-xs text-muted-foreground">
                          {bundle.items.map((item) => item.description).join(", ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{bundle.checklist.code}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {bundle.items.length}
                      {mandatory ? ` (${mandatory} mandatory)` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <OrgStatusBadge status={stateOf(bundle.checklist)} />
                    </td>
                    <td className="px-4 py-3">
                      {archived ? null : (
                        <RowActions
                          actions={[
                            { label: "Edit", onClick: () => openForm(bundle) },
                            stateOf(bundle.checklist) === "active"
                              ? { label: "Deactivate", onClick: () => void handleSetActive(bundle, false) }
                              : { label: "Activate", onClick: () => void handleSetActive(bundle, true) },
                            { label: "Delete", danger: true, onClick: () => void handleArchive(bundle.checklist.id) },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
