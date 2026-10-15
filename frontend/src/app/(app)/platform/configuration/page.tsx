"use client";

import { useEffect, useState } from "react";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/ui/row-actions";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { industriesApi, type Industry } from "@/lib/platform/api";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";

export default function AppConfigurationPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    return industriesApi
      .list()
      .then(setIndustries)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load industries"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function addIndustry(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await industriesApi.create(name.trim());
      toast(`${name.trim()} added`);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the industry");
    } finally {
      setSaving(false);
    }
  }

  async function rename(industry: Industry) {
    const next = draft.trim();
    if (!next || next === industry.name) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await industriesApi.update(industry.id, next);
      toast(`${next} saved`);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename the industry");
    } finally {
      setSaving(false);
    }
  }

  async function remove(industry: Industry) {
    if (!window.confirm(`Remove ${industry.name}?`)) return;
    setError(null);
    try {
      await industriesApi.remove(industry.id, false);
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== "IN_USE") {
        setError(err instanceof ApiError ? err.message : "Could not remove the industry");
        return;
      }
      const lines = Array.isArray(err.details) ? err.details.map(String) : [];
      const extra = lines.length ? `\n\n${lines.map((line) => `• ${line}`).join("\n")}` : "";
      if (!window.confirm(`${industry.name} is used by tenants.${extra}\n\nRemove it anyway? Those tenants will be set to Others.`)) {
        return;
      }
      try {
        await industriesApi.remove(industry.id, true);
      } catch (forceErr) {
        setError(forceErr instanceof ApiError ? forceErr.message : "Could not remove the industry");
        return;
      }
    }
    toast(`${industry.name} removed`);
    await load();
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="App configuration"
        description="Industries a platform admin can assign when creating or editing a tenant. Others stays on the list so a tenant is never left without one."
      />
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
                <th className="px-4 py-2.5 font-medium">Industry</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {industries.map((industry) => (
                <tr key={industry.id} className="row-hover border-t border-border first:border-t-0">
                  <td className="px-4 py-3">
                    {editingId === industry.id ? (
                      <input
                        value={draft}
                        autoFocus
                        required
                        pattern={NAME_PATTERN}
                        title={NAME_HINT}
                        maxLength={128}
                        className={FIELD_CLASS}
                        onChange={(event) => setDraft(event.target.value)}
                      />
                    ) : (
                      <span className="font-medium">
                        {industry.name}
                        {industry.isFallback ? <span className="ml-2 font-normal text-muted-foreground">Default</span> : null}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={
                        editingId === industry.id
                          ? [
                              { label: "Save", disabled: saving, onClick: () => void rename(industry) },
                              { label: "Cancel", disabled: saving, onClick: () => setEditingId(null) },
                            ]
                          : [
                              {
                                label: "Rename",
                                disabled: saving,
                                onClick: () => {
                                  setEditingId(industry.id);
                                  setDraft(industry.name);
                                },
                              },
                              industry.isFallback
                                ? null
                                : { label: "Remove", danger: true, disabled: saving, onClick: () => void remove(industry) },
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
      <form onSubmit={addIndustry} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-5">
        <label className="grid min-w-64 flex-1 gap-1.5 text-sm">
          <span className="font-medium">New industry</span>
          <input
            required
            value={name}
            pattern={NAME_PATTERN}
            title={NAME_HINT}
            maxLength={128}
            className={FIELD_CLASS}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Add industry"}
        </Button>
      </form>
    </AdminPage>
  );
}
