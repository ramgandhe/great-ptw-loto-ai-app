"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, fetchApi } from "@/lib/api";
import { deleteWithAssignmentConfirm } from "@/lib/confirm-delete";
import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import type { EntityField } from "@/lib/organisation/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";

type PpeCategory = { id: string; name: string };

export default function PpePage() {
  const [categories, setCategories] = useState<PpeCategory[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadCategories() {
    return fetchApi<PpeCategory[]>("/ppe-categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  const fields = useMemo<EntityField[]>(
    () => [
      { key: "name", label: "PPE item", required: true },
      { key: "code", label: "Code", required: true },
      {
        key: "category",
        label: "Category",
        required: true,
        options: categories.map((category) => ({ value: category.name, label: category.name })),
      },
      { key: "description", label: "Description", multiline: true },
    ],
    [categories],
  );

  async function saveCategory(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await fetchApi(`/ppe-categories/${editingId}`, { method: "PATCH", body: JSON.stringify({ name: trimmed }) });
        toast("Category updated");
      } else {
        await fetchApi("/ppe-categories", { method: "POST", body: JSON.stringify({ name: trimmed }) });
        toast("Category added");
      }
      setName("");
      setEditingId(null);
      await loadCategories();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this category");
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(category: PpeCategory) {
    try {
      const removed = await deleteWithAssignmentConfirm(category.name, (force) =>
        fetchApi(`/ppe-categories/${category.id}${force ? "?force=true" : ""}`, { method: "DELETE" }).then(() => undefined),
      );
      if (!removed) return;
      if (editingId === category.id) {
        setEditingId(null);
        setName("");
      }
      toast("Category removed");
      await loadCategories();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove this category");
    }
  }

  return (
    <EntityCrudPage
      title="PPE configuration"
      description="Protective equipment. Categories are labels the admin manages."
      resource="ppe"
      fields={fields}
    >
      <section className="grid gap-3 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Categories</h2>
        <p className="text-sm text-muted-foreground">Add a category before assigning it to a PPE item.</p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {categories.length === 0 ? <p className="text-sm text-muted-foreground">No categories yet.</p> : (
          <ul className="grid gap-2">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{category.name}</span>
                <span className="flex gap-2">
                  <button type="button" className="underline" onClick={() => { setEditingId(category.id); setName(category.name); }}>Edit</button>
                  <button type="button" className="underline" onClick={() => void removeCategory(category)}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void saveCategory(event)}>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">{editingId ? "Category name" : "New category"}</span>
            <input className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} placeholder="Head Protection" />
          </label>
          <Button type="submit" disabled={saving || !name.trim()}>{editingId ? "Save category" : "Add category"}</Button>
          {editingId ? <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setName(""); }}>Cancel</Button> : null}
        </form>
      </section>
    </EntityCrudPage>
  );
}
