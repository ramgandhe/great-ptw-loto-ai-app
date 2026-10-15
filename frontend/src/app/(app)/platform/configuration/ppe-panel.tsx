"use client";

import { useEffect, useState } from "react";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/ui/row-actions";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformDefaultsApi, type DefaultPpeCategory, type DefaultPpeItem } from "@/lib/platform/api";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";

const CODE_PATTERN = String.raw`[A-Za-z0-9][A-Za-z0-9._\-/]*`;
const EMPTY_ITEM = { code: "", name: "", categoryId: "", description: "" };

export function PpePanel() {
  const [section, setSection] = useState<"categories" | "items">("categories");
  return (
    <div className="grid gap-4">
      <SegmentedToggle
        label="PPE"
        value={section}
        onChange={setSection}
        options={[
          { value: "categories", label: "Categories" },
          { value: "items", label: "Items" },
        ]}
      />
      {section === "categories" ? <Categories /> : <Items />}
    </div>
  );
}

function Categories() {
  const [rows, setRows] = useState<DefaultPpeCategory[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    return platformDefaultsApi
      .ppeCategories()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load PPE categories"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await platformDefaultsApi.createPpeCategory(name.trim());
      toast(`${name.trim()} added`);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the category");
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
      await platformDefaultsApi.updatePpeCategory(row.id, next);
      toast(`${next} saved`);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename the category");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: DefaultPpeCategory) {
    if (!window.confirm(`Remove ${row.name}?`)) return;
    setError(null);
    try {
      await platformDefaultsApi.removePpeCategory(row.id, false);
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== "IN_USE") {
        setError(err instanceof ApiError ? err.message : "Could not remove the category");
        return;
      }
      const lines = Array.isArray(err.details) ? err.details.map(String) : [];
      const extra = lines.length ? `\n\n${lines.map((line) => `• ${line}`).join("\n")}` : "";
      if (!window.confirm(`${row.name} is used by default PPE items.${extra}\n\nRemove it anyway? Those items will be set to Others.`)) {
        return;
      }
      try {
        await platformDefaultsApi.removePpeCategory(row.id, true);
      } catch (forceErr) {
        setError(forceErr instanceof ApiError ? forceErr.message : "Could not remove the category");
        return;
      }
    }
    toast(`${row.name} removed`);
    await load();
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        A category is a name only. Others stays on the list. Renaming a category updates the default PPE items that use it.
      </p>
      {error ? <Alert message={error} /> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Category</th>
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
                        maxLength={128}
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
          <span className="font-medium">New category</span>
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
          {saving ? "Saving…" : "Add category"}
        </Button>
      </form>
    </div>
  );
}

function Items() {
  const [rows, setRows] = useState<DefaultPpeItem[]>([]);
  const [categories, setCategories] = useState<DefaultPpeCategory[]>([]);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    return Promise.all([platformDefaultsApi.ppeItems(), platformDefaultsApi.ppeCategories()])
      .then(([items, cats]) => {
        setRows(items);
        setCategories(cats);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load PPE items"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function payload() {
    return {
      code: form.code.trim(),
      name: form.name.trim(),
      categoryId: form.categoryId,
      description: form.description.trim() || undefined,
    };
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await platformDefaultsApi.updatePpeItem(editingId, payload());
        toast(`${form.name.trim()} saved`);
      } else {
        await platformDefaultsApi.createPpeItem(payload());
        toast(`${form.name.trim()} added`);
      }
      setForm(EMPTY_ITEM);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the PPE item");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: DefaultPpeItem) {
    if (!window.confirm(`Remove ${row.name} from the default PPE items?`)) return;
    setError(null);
    try {
      await platformDefaultsApi.removePpeItem(row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setForm(EMPTY_ITEM);
      }
      toast(`${row.name} removed`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the PPE item");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Each item has a code, a name, a category, and a description. The category is chosen from the default category list.
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
                <th className="px-4 py-2.5 font-medium">Category</th>
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
                  <td className="px-4 py-3">{row.categoryName}</td>
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
                              categoryId: row.categoryId,
                              description: row.description ?? "",
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
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Category</span>
          <select
            required
            value={form.categoryId}
            className={FIELD_CLASS}
            onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
          >
            <option value="">Please select a category..</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
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
          <Button type="submit" disabled={saving || categories.length === 0}>
            {saving ? "Saving…" : editingId ? "Save PPE item" : "Add PPE item"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_ITEM);
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
