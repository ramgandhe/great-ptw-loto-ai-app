"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { masterDataApi, type MasterDataRecord } from "@/lib/master-data/api";
import { Button } from "@/components/ui/button";

const DEFAULT_COLOR = "#2563EB";
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export default function PermitTypesPage() {
  const [items, setItems] = useState<MasterDataRecord[]>([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    color: DEFAULT_COLOR,
    isActive: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    return masterDataApi
      .permitTypes()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load permit types"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function startEdit(item: MasterDataRecord) {
    setEditingId(item.id);
    setForm({
      code: item.code ?? "",
      name: item.name,
      description: item.description ?? "",
      color: item.color && HEX_COLOR.test(item.color) ? item.color : DEFAULT_COLOR,
      isActive: item.isActive !== false,
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ code: "", name: "", description: "", color: DEFAULT_COLOR, isActive: true });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: form.color.toUpperCase(),
      isActive: form.isActive,
    };
    try {
      if (editingId) {
        await masterDataApi.updatePermitType(editingId, payload);
      } else {
        await masterDataApi.createPermitType(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save permit type");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this permit type? Existing permits that use it will block deletion.");
    if (!confirmed) {
      return;
    }
    setError(null);
    try {
      await masterDataApi.deletePermitType(id);
      if (editingId === id) {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete permit type");
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Permit types</h1>
          <p className="text-sm text-muted-foreground">
            Define the permit types this organisation can issue, such as hot work or confined space.
          </p>
        </div>
        <Link href="/organisation">
          <Button variant="outline">Back</Button>
        </Link>
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
        <h2 className="text-sm font-semibold">{editingId ? "Edit permit type" : "Add permit type"}</h2>
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
          <span className="font-medium">Name *</span>
          <input
            required
            value={form.name}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            value={form.description}
            rows={3}
            className="rounded-lg border border-border bg-background px-3 py-2"
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Color *</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={HEX_COLOR.test(form.color) ? form.color : DEFAULT_COLOR}
              className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background"
              onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value.toUpperCase() }))}
            />
            <input
              required
              pattern="#[0-9A-Fa-f]{6}"
              value={form.color}
              className="h-9 flex-1 rounded-lg border border-border bg-background px-3 font-mono"
              onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
            />
          </div>
          <span className="text-xs text-muted-foreground">Hex color used for this permit type in this organisation.</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
          />
          Active for new permits
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Update permit type" : "Add permit type"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Configured types</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No permit types yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Color</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono">{item.code ?? "—"}</td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">
                      {item.color ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-4 w-4 rounded-sm border border-border"
                            style={{ backgroundColor: item.color }}
                            aria-hidden
                          />
                          <span className="font-mono text-xs">{item.color}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{item.isActive === false ? "Inactive" : "Active"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(item)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
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
