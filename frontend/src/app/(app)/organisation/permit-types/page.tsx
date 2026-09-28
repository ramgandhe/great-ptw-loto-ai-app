"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { masterDataApi, type MasterDataRecord } from "@/lib/master-data/api";
import { permitTemplatesApi, type PermitTemplate } from "@/lib/organisation/templates";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";

const DEFAULT_COLOR = "#2563EB";
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const EMPTY_FORM = { code: "", name: "", description: "", color: DEFAULT_COLOR, isActive: true };

export default function PermitTypesPage() {
  const [items, setItems] = useState<MasterDataRecord[]>([]);
  const [templates, setTemplates] = useState<PermitTemplate[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function load() {
    return masterDataApi
      .permitTypes()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load permit types"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    permitTemplatesApi.list().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  function openForm(item?: MasterDataRecord) {
    setEditingId(item?.id ?? null);
    setForm(
      item
        ? {
            code: item.code ?? "",
            name: item.name,
            description: item.description ?? "",
            color: item.color && HEX_COLOR.test(item.color) ? item.color : DEFAULT_COLOR,
            isActive: item.isActive !== false,
          }
        : EMPTY_FORM,
    );
    setError(null);
    setSavedMessage(null);
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
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
      setSavedMessage(`${editingId ? "Saved" : "Added"} ${payload.name}.`);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save permit type");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this permit type? Existing permits that use it will block deletion.")) {
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
    <AdminPage>
      <AdminPageHeader
        title="Permit types"
        description="The permit types this organisation can issue, such as hot work or confined space."
        action={
          !formOpen ? (
            <Button type="button" size="lg" onClick={() => openForm()}>
              <Plus aria-hidden />
              Add permit type
            </Button>
          ) : null
        }
      />

      {savedMessage ? (
        <p role="status" className="text-sm font-medium text-(--status-success)">
          {savedMessage}
        </p>
      ) : null}

      {formOpen ? (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="reveal-in grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
        >
          <h2 className="font-semibold sm:col-span-2">{editingId ? `Edit ${form.name || "permit type"}` : "New permit type"}</h2>
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
              rows={3}
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
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
                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value.toUpperCase() }))}
              />
              <input
                required
                pattern="#[0-9A-Fa-f]{6}"
                value={form.color}
                className={`${FIELD_CLASS} flex-1 font-mono`}
                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
              />
            </div>
            <span className="text-xs text-muted-foreground">Shown on this type&rsquo;s permits.</span>
          </label>
          <label className="flex items-center gap-2 self-center text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Active for new permits
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add permit type"}
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
          <p className="font-medium">No permit types yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the first permit type so people can raise permits.</p>
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Templates</th>
                <th className="px-4 py-2.5 font-medium">Colour</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`cursor-pointer border-t border-border first:border-t-0 hover:bg-muted/40 ${editingId === item.id ? "bg-muted/60" : ""}`}
                  onClick={() => openForm(item)}
                >
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: item.color ?? "transparent" }}
                        aria-hidden
                      />
                      {item.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.code ?? ""}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {templates.filter((t) => t.appliesToAllTypes || t.permitTypeIds.includes(item.id)).length === 0 ? (
                      <span className="text-xs text-muted-foreground">None linked</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {templates
                          .filter((t) => t.appliesToAllTypes || t.permitTypeIds.includes(item.id))
                          .map((t) => (
                            <Link
                              key={t.id}
                              href={`/organisation/templates/${t.id}`}
                              className="rounded-full bg-muted px-2 py-0.5 text-xs hover:underline"
                            >
                              {t.name}
                            </Link>
                          ))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.color ?? ""}</td>
                  <td className="px-4 py-3">{item.isActive === false ? "Inactive" : "Active"}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-3">
                      <button type="button" className="text-primary hover:underline" onClick={() => openForm(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive hover:underline"
                        onClick={() => void handleDelete(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
