"use client";

import { useEffect, useState } from "react";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformDefaultsApi, type DefaultPermitType } from "@/lib/platform/api";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";

const DEFAULT_COLOR = "#2563EB";
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const CODE_PATTERN = String.raw`[A-Za-z0-9][A-Za-z0-9._\-/]*`;
const EMPTY = { code: "", name: "", description: "", color: DEFAULT_COLOR };

export function PermitTypesPanel() {
  const [rows, setRows] = useState<DefaultPermitType[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    return platformDefaultsApi
      .permitTypes()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load permit types"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function payload() {
    return {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: (HEX_COLOR.test(form.color) ? form.color : DEFAULT_COLOR).toUpperCase(),
    };
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await platformDefaultsApi.updatePermitType(editingId, payload());
        toast(`${form.name.trim()} saved`);
      } else {
        await platformDefaultsApi.createPermitType(payload());
        toast(`${form.name.trim()} added`);
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the permit type");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: DefaultPermitType) {
    if (!(await confirmAction(`Remove ${row.name} from the default permit types?`))) return;
    setError(null);
    try {
      await platformDefaultsApi.removePermitType(row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setForm(EMPTY);
      }
      toast(`${row.name} removed`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the permit type");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Permit types copied onto a tenant when it is created. Each one has a code, a name, a description, and a colour.
      </p>
      {error ? <Alert message={error} /> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Colour</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="row-hover border-t border-border first:border-t-0">
                  <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded-sm border border-border" style={{ backgroundColor: row.color }} />
                      {row.color}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-3 text-muted-foreground">{row.description || "—"}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        {
                          label: "Edit",
                          onClick: () => {
                            setEditingId(row.id);
                            setForm({
                              code: row.code,
                              name: row.name,
                              description: row.description ?? "",
                              color: HEX_COLOR.test(row.color) ? row.color : DEFAULT_COLOR,
                            });
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
          <span className="font-medium">Code</span>
          <input
            required
            value={form.code}
            pattern={CODE_PATTERN}
            maxLength={64}
            className={`${FIELD_CLASS} font-mono`}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Name</span>
          <input
            required
            value={form.name}
            pattern={NAME_PATTERN}
            title={NAME_HINT}
            maxLength={255}
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
            rows={3}
            maxLength={4000}
            className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Colour</span>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Pick colour"
              value={HEX_COLOR.test(form.color) ? form.color : DEFAULT_COLOR}
              className="h-10 w-12 cursor-pointer rounded-md border border-border bg-background"
              onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value.toUpperCase() }))}
            />
            <input
              required
              pattern="#[0-9A-Fa-f]{6}"
              value={form.color}
              className={`${FIELD_CLASS} flex-1 font-mono`}
              onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
            />
          </div>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save permit type" : "Add permit type"}
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
