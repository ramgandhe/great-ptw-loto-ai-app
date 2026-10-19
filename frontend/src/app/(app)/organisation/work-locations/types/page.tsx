"use client";

import { useEffect, useState } from "react";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { deleteWithAssignmentConfirm } from "@/lib/confirm-delete";
import { ApiError } from "@/lib/api";
import { placeApi, type NamedType } from "@/lib/place/api";

export default function LocationTypesPage() {
  const [rows, setRows] = useState<NamedType[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    return placeApi.listLocationTypes().then(setRows);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load location types"));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await placeApi.updateLocationType(editingId, { name: nextName, description: description.trim() || null });
        toast("Location type updated");
      } else {
        await placeApi.createLocationType({ name: nextName, description: description.trim() || undefined });
        toast("Location type added");
      }
      setName("");
      setDescription("");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this location type");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: NamedType) {
    setError(null);
    try {
      const removed = await deleteWithAssignmentConfirm(row.name, (force) =>
        placeApi.deleteLocationType(row.id, force).then(() => undefined),
      );
      if (!removed) return;
      if (editingId === row.id) {
        setEditingId(null);
        setName("");
        setDescription("");
      }
      toast("Location type removed");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove this location type");
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader title="Location types" description="Labels only. They do not change how a location behaves." back={{ href: "/organisation/work-locations", label: "Work locations" }} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No location types yet.</p> : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{row.name}</span>
                {row.description ? <span className="mt-0.5 block text-muted-foreground">{row.description}</span> : null}
              </span>
              <span className="flex gap-2">
                <button type="button" className="underline" onClick={() => { setEditingId(row.id); setName(row.name); setDescription(row.description ?? ""); }}>Edit</button>
                <button type="button" className="underline" onClick={() => void remove(row)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{editingId ? "Type name" : "New type"}</span>
          <input className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Description</span>
          <input className={FIELD_CLASS} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !name.trim()}>{editingId ? "Save type" : "Add type"}</Button>
          {editingId ? <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setName(""); setDescription(""); }}>Cancel</Button> : null}
        </div>
      </form>
    </AdminPage>
  );
}
