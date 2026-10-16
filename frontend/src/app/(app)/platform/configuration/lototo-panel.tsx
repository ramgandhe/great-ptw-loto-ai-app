"use client";

import { useEffect, useState } from "react";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformDefaultsApi, type DefaultPpeCategory } from "@/lib/platform/api";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";

export function LototoPanel() {
  const [section, setSection] = useState<"energy-source">("energy-source");
  return (
    <div className="grid gap-4">
      <SegmentedToggle
        label="LOTOTO"
        value={section}
        onChange={setSection}
        options={[{ value: "energy-source", label: "Energy source" }]}
      />
      <EnergySources />
    </div>
  );
}

function EnergySources() {
  const [rows, setRows] = useState<DefaultPpeCategory[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    return platformDefaultsApi
      .energySources()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load energy sources"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await platformDefaultsApi.createEnergySource(name.trim());
      toast(`${name.trim()} added`);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the energy source");
    } finally {
      setSaving(false);
    }
  }

  async function rename(row: DefaultPpeCategory) {
    const next = draft.trim();
    if (!next || next === row.name) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await platformDefaultsApi.updateEnergySource(row.id, next);
      toast(`${next} saved`);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename the energy source");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: DefaultPpeCategory) {
    if (!(await confirmAction(`Remove ${row.name} from the default energy sources?`))) return;
    setError(null);
    try {
      await platformDefaultsApi.removeEnergySource(row.id);
      toast(`${row.name} removed`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the energy source");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Energy sources copied onto a tenant when it is created. Each one is a name. Other stays on the list.
      </p>
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Energy source</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="row-hover border-t border-border first:border-t-0">
                  <td className="px-4 py-3">
                    {editingId === row.id ? (
                      <input
                        value={draft}
                        autoFocus
                        required
                        pattern={NAME_PATTERN}
                        title={NAME_HINT}
                        maxLength={64}
                        className={FIELD_CLASS}
                        onChange={(event) => setDraft(event.target.value)}
                      />
                    ) : (
                      <span className="font-medium">
                        {row.name}
                        {row.isFallback ? <span className="ml-2 font-normal text-muted-foreground">Default</span> : null}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={
                        editingId === row.id
                          ? [
                              { label: "Save", disabled: saving, onClick: () => void rename(row) },
                              { label: "Cancel", disabled: saving, onClick: () => setEditingId(null) },
                            ]
                          : [
                              {
                                label: "Rename",
                                disabled: saving,
                                onClick: () => {
                                  setEditingId(row.id);
                                  setDraft(row.name);
                                },
                              },
                              row.isFallback
                                ? null
                                : { label: "Remove", danger: true, disabled: saving, onClick: () => void remove(row) },
                            ]
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-5">
        <label className="grid min-w-64 flex-1 gap-1.5 text-sm">
          <span className="font-medium">New energy source</span>
          <input
            required
            value={name}
            pattern={NAME_PATTERN}
            title={NAME_HINT}
            maxLength={64}
            className={FIELD_CLASS}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Add energy source"}
        </Button>
      </form>
    </div>
  );
}
