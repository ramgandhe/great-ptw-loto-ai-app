"use client";

import { useEffect, useState } from "react";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformDefaultsApi, type DefaultLocationType } from "@/lib/platform/api";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";

const EMPTY = { name: "", description: "" };

export function LocationsPanel() {
  const [rows, setRows] = useState<DefaultLocationType[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    return platformDefaultsApi
      .locationTypes()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load location types"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function payload() {
    return { name: form.name.trim(), description: form.description.trim() || undefined };
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (form.name.trim().toLowerCase() === "site") {
      setError("Site is not a location type");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await platformDefaultsApi.updateLocationType(editingId, payload());
        toast(`${form.name.trim()} saved`);
      } else {
        await platformDefaultsApi.createLocationType(payload());
        toast(`${form.name.trim()} added`);
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the location type");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: DefaultLocationType) {
    if (!(await confirmAction(`Remove ${row.name} from the default location types?`))) return;
    setError(null);
    try {
      await platformDefaultsApi.removeLocationType(row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setForm(EMPTY);
      }
      toast(`${row.name} removed`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the location type");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Location types copied onto a tenant when it is created. A name and an optional description. Site is not a location type.
      </p>
      {error ? <Alert message={error} /> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="row-hover border-t border-border first:border-t-0">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.description || "—"}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        {
                          label: "Edit",
                          onClick: () => {
                            setEditingId(row.id);
                            setForm({ name: row.name, description: row.description ?? "" });
                          },
                        },
                        { label: "Remove", danger: true, onClick: () => void remove(row) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={save} className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Name</span>
          <input
            required
            value={form.name}
            pattern={NAME_PATTERN}
            title={NAME_HINT}
            maxLength={64}
            className={FIELD_CLASS}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <textarea
            value={form.description}
            rows={2}
            maxLength={2000}
            className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save location type" : "Add location type"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Alert({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}
