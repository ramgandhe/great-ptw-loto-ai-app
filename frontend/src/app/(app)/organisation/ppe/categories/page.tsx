"use client";

import { useEffect, useState } from "react";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ApiError, fetchApi } from "@/lib/api";
import { deleteWithAssignmentConfirm } from "@/lib/confirm-delete";

type PpeCategory = { id: string; name: string };

export default function PpeCategoriesPage() {
  const [rows, setRows] = useState<PpeCategory[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    return fetchApi<PpeCategory[]>("/ppe-categories").then(setRows);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load categories"));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await fetchApi(`/ppe-categories/${editingId}`, { method: "PATCH", body: JSON.stringify({ name: nextName }) });
        toast("Category updated");
      } else {
        await fetchApi("/ppe-categories", { method: "POST", body: JSON.stringify({ name: nextName }) });
        toast("Category added");
      }
      setName("");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this category");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: PpeCategory) {
    setError(null);
    try {
      const removed = await deleteWithAssignmentConfirm(row.name, (force) =>
        fetchApi(`/ppe-categories/${row.id}${force ? "?force=true" : ""}`, { method: "DELETE" }).then(() => undefined),
      );
      if (!removed) return;
      if (editingId === row.id) {
        setEditingId(null);
        setName("");
      }
      toast("Category removed");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove this category");
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader title="PPE categories" description="Add a category before assigning it to a PPE item." back={{ href: "/organisation/ppe", label: "PPE" }} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No categories yet.</p> : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span className="font-medium">{row.name}</span>
              <span className="flex gap-2">
                <button type="button" className="underline" onClick={() => { setEditingId(row.id); setName(row.name); }}>Edit</button>
                <button type="button" className="underline" onClick={() => void remove(row)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void save(event)}>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{editingId ? "Category name" : "New category"}</span>
          <input className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <Button type="submit" disabled={saving || !name.trim()}>{editingId ? "Save category" : "Add category"}</Button>
        {editingId ? <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setName(""); }}>Cancel</Button> : null}
      </form>
    </AdminPage>
  );
}
