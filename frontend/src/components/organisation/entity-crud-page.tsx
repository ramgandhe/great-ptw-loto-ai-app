"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  approvalWorkflowsApi,
  departmentsApi,
  locationsApi,
  machineryApi,
  notificationPreferencesApi,
  plantsApi,
  hazardsApi,
  ppeConfigurationsApi,
  safetyChecklistsApi,
  workstationsApi,
} from "@/lib/organisation/api";
import type { EntityField, OrgRecord } from "@/lib/organisation/types";
import { loadEntitySelectOptions, type EntitySelectResource } from "@/lib/form-options";
import { OrgStatusBadge, stateOf } from "./org-status-badge";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/ui/row-actions";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { formatDateTime } from "@/lib/format";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";

/** Lists whose archived records the API can return (see listArchived). */
const ARCHIVE_VIEW: readonly string[] = ["plants", "departments", "locations", "workflows"];

const entityApis = {
  plants: plantsApi,
  departments: departmentsApi,
  locations: locationsApi,
  workstations: workstationsApi,
  machinery: machineryApi,
  workflows: approvalWorkflowsApi,
  checklists: safetyChecklistsApi,
  ppe: ppeConfigurationsApi,
  hazards: hazardsApi,
  notifications: notificationPreferencesApi,
} as const;

export type OrganisationEntityResource = keyof typeof entityApis;

/**
 * Lets a page that shows several lists together (setup's Sites and equipment) carry context between
 * them: new records start with `defaults` (e.g. the plant just added), `onSaved` reports each new
 * record, and a changed `version` reloads the parent pickers so a just-added parent is offered.
 * Absent on the standalone pages.
 */
export const EntityParentContext = createContext<{
  defaults: Partial<Record<OrganisationEntityResource, Record<string, string>>>;
  onSaved: (resource: OrganisationEntityResource, record: OrgRecord) => void;
  version: number;
} | null>(null);

type EntityApi = (typeof entityApis)[OrganisationEntityResource];

type EntityCrudPageProps = {
  title: string;
  description: string;
  resource: OrganisationEntityResource;
  fields: EntityField[];
  nameField?: keyof OrgRecord;
};

function emptyForm(fields: EntityField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}

/** "Departments" -> "department", "Machinery" -> "machinery", "PPE" stays "PPE". */
function singularOf(title: string): string {
  const word = title.endsWith("ies") ? `${title.slice(0, -3)}y` : title.endsWith("s") ? title.slice(0, -1) : title;
  return word === word.toUpperCase() ? word : word.toLowerCase();
}

/** Suggested code from a name: "Main compressor" -> "MAIN-COMPRESSOR". */
function codeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

export function EntityCrudPage({
  title,
  description,
  resource,
  fields,
  nameField = "name",
}: EntityCrudPageProps) {
  const api = entityApis[resource] as EntityApi;
  const parentContext = useContext(EntityParentContext);
  const [items, setItems] = useState<OrgRecord[]>([]);
  const [form, setForm] = useState<Record<string, string>>(() => emptyForm(fields));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [archivedItems, setArchivedItems] = useState<OrgRecord[] | null>(null);
  const addAnother = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const singular = singularOf(title);
  const parentField = fields.find((field) => field.select);
  const hasCode = fields.some((field) => field.key === "code");
  const selectResources = fields
    .map((field) => field.select)
    .filter((resource): resource is EntitySelectResource => Boolean(resource));
  const [selectOptions, setSelectOptions] = useState<
    Partial<Record<EntitySelectResource, { value: string; label: string }[]>>
  >({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setArchivedItems(null);
    api
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load records"))
      .finally(() => setLoading(false));
  }, [api]);

  function showView(next: "active" | "archived") {
    setView(next);
    if (next === "archived" && archivedItems === null && "listArchived" in api) {
      api
        .listArchived()
        .then(setArchivedItems)
        .catch((err) => setError(err instanceof ApiError ? err.message : "Archived records could not be loaded"));
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectResources.length === 0) {
      return;
    }
    loadEntitySelectOptions(selectResources)
      .then(setSelectOptions)
      .catch(() => setSelectOptions({}));
  }, [selectResources.join(","), parentContext?.version]);

  function resetForm() {
    setForm(emptyForm(fields));
    setEditingId(null);
    setFormOpen(false);
  }

  function openCreate() {
    setForm({ ...emptyForm(fields), ...(parentContext?.defaults[resource] ?? {}) });
    setEditingId(null);
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function startEdit(item: OrgRecord) {
    setEditingId(item.id);
    setForm(Object.fromEntries(fields.map((f) => [f.key, String(item[f.key as keyof OrgRecord] ?? "")])));
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const parentLabels = useMemo(
    () => new Map((parentField?.select ? (selectOptions[parentField.select] ?? []) : []).map((o) => [o.value, o.label])),
    [parentField, selectOptions],
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item[nameField], item.code, item.category, parentField ? parentLabels.get(String(item[parentField.key as keyof OrgRecord] ?? "")) : null]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [items, query, nameField, parentField, parentLabels]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = Object.fromEntries(
      fields
        .map((f) => [f.key, form[f.key]?.trim() ?? ""] as const)
        .filter(([, value]) => value !== ""),
    );

    try {
      if (editingId) {
        await api.update(editingId, payload);
      } else {
        const created = await api.create(payload);
        parentContext?.onSaved(resource, created);
      }
      const savedName = form[String(nameField)] || form.name || singular;
      toast(`${savedName} ${editingId ? "saved" : "added"}`);
      if (addAnother.current && !editingId) {
        // Keep the parent selection so several items for the same place can be added in a row.
        setForm({ ...emptyForm(fields), ...(parentField ? { [parentField.key]: form[parentField.key] ?? "" } : {}) });
      } else {
        resetForm();
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate(id: string) {
    setError(null);
    try {
      await approvalWorkflowsApi.activate(id);
      toast("Workflow activated");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Activate failed");
    }
  }

  /** Deactivate keeps the record listed but stops it being offered on permits and forms. */
  async function handleSetActive(item: OrgRecord, on: boolean) {
    const name = String(item[nameField] ?? singular);
    if (!on && !window.confirm(`Deactivate ${name}? It stays on this list but is no longer offered on permits.`)) return;
    setError(null);
    // Each list stores "in use" its own way; the button is the same everywhere.
    const patch =
      resource === "plants" || resource === "departments" || resource === "locations"
        ? { status: on ? "active" : "inactive" }
        : resource === "notifications"
          ? { enabled: on }
          : { isActive: on };
    try {
      await api.update(item.id, patch as never);
      toast(`${name} ${on ? "activated" : "deactivated"}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `${on ? "Activate" : "Deactivate"} failed`);
    }
  }

  async function handleArchive(id: string) {
    const name = String(items.find((item) => item.id === id)?.[nameField] ?? singular);
    if (!window.confirm(`Delete ${name}? It is removed from this list; permits that used it keep their record.`)) {
      return;
    }
    setError(null);
    try {
      await api.archive(id);
      toast(`${name} deleted`);
      if (editingId === id) {
        resetForm();
      }
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title={title}
        description={description}
        action={
          !formOpen ? (
            <Button type="button" size="lg" onClick={openCreate}>
              <Plus aria-hidden />
              Add {singular}
            </Button>
          ) : null
        }
      >
        {ARCHIVE_VIEW.includes(resource) || items.length > 5 ? (
          <div className="flex flex-wrap items-center gap-3">
            {ARCHIVE_VIEW.includes(resource) ? (
              <SegmentedToggle
                label="Show"
                value={view}
                onChange={(v) => showView(v as "active" | "archived")}
                options={[
                  { value: "active", label: "Active", count: items.length },
                  { value: "archived", label: "Deleted", ...(archivedItems ? { count: archivedItems.length } : {}) },
                ]}
              />
            ) : null}
            {items.length > 5 && view === "active" ? (
              <label className="relative flex h-10 items-center sm:w-80">
                <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
                <span className="sr-only">Search {title.toLowerCase()}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${items.length} ${title.toLowerCase()}`}
                  className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </AdminPageHeader>

      {view === "archived" ? (
        archivedItems === null ? (
          <p className="text-sm text-muted-foreground">Loading deleted {title.toLowerCase()}…</p>
        ) : archivedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing deleted.</p>
        ) : (
          <div className="table-box">
            <table className="min-w-full text-sm">
              <thead className="table-tone text-left text-xs">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Deleted</th>
                </tr>
              </thead>
              <tbody>
                {archivedItems.map((item) => (
                  <tr key={item.id} className="border-t border-border first:border-t-0 text-muted-foreground">
                    <td className="px-4 py-3 font-medium text-foreground">{String(item[nameField] ?? "Unnamed")}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.code ?? ""}</td>
                    <td className="px-4 py-3">{formatDateTime(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {formOpen ? (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="reveal-in grid scroll-mt-[calc(4.5rem+var(--page-head-h,0px))] gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
        >
          <h2 className="font-semibold sm:col-span-2">
            {editingId ? `Edit ${String(form[String(nameField)] || singular)}` : `New ${singular}`}
          </h2>
          {fields.map((field) => (
            <label key={field.key} className={`grid gap-1.5 text-sm ${field.multiline ? "sm:col-span-2" : ""}`}>
              <span className="font-medium">
                {field.label}
                {field.required ? "" : <span className="font-normal text-muted-foreground"> (optional)</span>}
              </span>
              {field.multiline ? (
                <textarea
                  required={field.required}
                  rows={3}
                  value={form[field.key] ?? ""}
                  className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              ) : field.select || field.options ? (
                <select
                  required={field.required}
                  value={form[field.key] ?? ""}
                  className="h-10 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {(field.options ?? (field.select ? (selectOptions[field.select] ?? []) : [])).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required={field.required}
                  value={form[field.key] ?? ""}
                  autoFocus={field === fields[0]}
                  {...(field.key === nameField ? { pattern: NAME_PATTERN, title: NAME_HINT, maxLength: 255 } : {})}
                  placeholder={field.key === "code" && hasCode && form[String(nameField)] ? codeFromName(form[String(nameField)]) : undefined}
                  className="h-10 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  onBlur={() => {
                    // Suggest a code from the name the first time the name is filled in.
                    if (field.key === nameField && hasCode && !form.code && form[field.key]) {
                      setForm((prev) => ({ ...prev, code: codeFromName(prev[field.key] ?? "") }));
                    }
                  }}
                />
              )}
            </label>
          ))}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={submitting} onClick={() => (addAnother.current = false)}>
              {submitting ? "Saving…" : editingId ? "Save changes" : `Add ${singular}`}
            </Button>
            {!editingId ? (
              <Button type="submit" variant="outline" disabled={submitting} onClick={() => (addAnother.current = true)}>
                Add and add another
              </Button>
            ) : null}
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


      {view === "archived" ? null : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">No {title.toLowerCase()} yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the first {singular} so it can be picked on permits.</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Name</th>
                {parentField ? <th className="px-4 py-2.5 font-medium">{parentField.label}</th> : null}
                <th className="px-4 py-2.5 font-medium">Code</th>
                {fields.some((field) => field.key === "category") ? (
                  <th className="px-4 py-2.5 font-medium">Category</th>
                ) : null}
                {fields.some((field) => field.key === "approverRole") ? (
                  <th className="px-4 py-2.5 font-medium">Approver</th>
                ) : null}
                {fields.some((field) => field.key === "severity") ? (
                  <th className="px-4 py-2.5 font-medium">Severity</th>
                ) : null}
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr
                  key={item.id}
                  className={`row-hover cursor-pointer border-t border-border first:border-t-0 ${editingId === item.id ? "bg-muted/60" : ""}`}
                  onClick={() => startEdit(item)}
                >
                  <td className="px-4 py-3 font-medium">{String(item[nameField] ?? "Unnamed")}</td>
                  {parentField ? (
                    <td className="px-4 py-3 text-muted-foreground">
                      {parentLabels.get(String(item[parentField.key as keyof OrgRecord] ?? "")) ?? "Not set"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.code ?? ""}</td>
                  {fields.some((field) => field.key === "category") ? (
                    <td className="px-4 py-3 text-muted-foreground">{item.category ?? ""}</td>
                  ) : null}
                  {fields.some((field) => field.key === "approverRole") ? (
                    <td className="px-4 py-3 text-muted-foreground">{item.approverRole ?? ""}</td>
                  ) : null}
                  {fields.some((field) => field.key === "severity") ? (
                    <td className="px-4 py-3 text-muted-foreground">{item.severity ?? ""}</td>
                  ) : null}
                  <td className="px-4 py-3">
                    <OrgStatusBadge status={resource === "workflows" ? (item.isCurrent ? "active" : "inactive") : stateOf(item)} />
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => startEdit(item) },
                        // A workflow is active when it is the one in use; activating another replaces it.
                        resource === "workflows"
                          ? !item.isCurrent && { label: "Activate", onClick: () => void handleActivate(item.id) }
                          : stateOf(item) === "active"
                            ? { label: "Deactivate", onClick: () => void handleSetActive(item, false) }
                            : { label: "Activate", onClick: () => void handleSetActive(item, true) },
                        !item.isCurrent && { label: "Delete", danger: true, onClick: () => void handleArchive(item.id) },
                      ]}
                    />
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
