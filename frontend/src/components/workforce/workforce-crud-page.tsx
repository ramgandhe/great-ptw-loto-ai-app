"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { ApiError } from "@/lib/api";
import { agenciesApi, competenciesApi, contractorsApi, employeesApi } from "@/lib/workforce/api";
import type { CompetencyRecord, EntityField, WorkforceRecord } from "@/lib/workforce/types";
import { loadEntitySelectOptions, type EntitySelectResource } from "@/lib/form-options";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { NAME_HINT, NAME_PATTERN, PHONE_COUNTRIES, splitPhone } from "@/lib/validation";
import { copyText } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const workforceApis = {
  employees: employeesApi,
  contractors: contractorsApi,
  agencies: agenciesApi,
  competencies: competenciesApi,
  certifications: competenciesApi,
} as const;

export type WorkforceEntityResource = keyof typeof workforceApis;

type WorkforceItem = WorkforceRecord | CompetencyRecord;

function emptyForm(fields: EntityField[]) {
  return Object.fromEntries(fields.map((f) => [f.key, f.key === "phone" ? `${PHONE_COUNTRIES[0].code} ` : ""]));
}

const INPUT_CLASS =
  "h-9 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 user-invalid:border-destructive";
const isDate = (key: string) => key.endsWith("Date");

/** Country code plus a national number of the right length; stored as "+91 9876543210". */
function PhoneInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { code, number } = splitPhone(value);
  const digits = PHONE_COUNTRIES.find((c) => c.code === code)?.digits ?? 10;
  return (
    <span className="flex gap-2">
      <select aria-label="Country code" value={code} className={`${INPUT_CLASS} w-36 px-2`} onChange={(e) => onChange(`${e.target.value} ${number}`)}>
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={number}
        pattern={`[0-9]{${digits}}`}
        maxLength={digits}
        title={`${digits} digits, numbers only`}
        placeholder={"9".repeat(digits)}
        className={`${INPUT_CLASS} min-w-0 flex-1 tabular-nums`}
        onChange={(e) => onChange(`${code} ${e.target.value.replace(/\D/g, "").slice(0, digits)}`)}
      />
    </span>
  );
}

export function WorkforceCrudPage({
  title,
  description,
  resource,
  fields,
}: {
  title: string;
  description: string;
  resource: WorkforceEntityResource;
  fields: EntityField[];
}) {
  const api = workforceApis[resource];
  const [items, setItems] = useState<WorkforceItem[]>([]);
  const [form, setForm] = useState(() => emptyForm(fields));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const singular = title.replace(/ management$/i, "").replace(/ies$/, "y").replace(/s$/, "").toLowerCase();
  const parentField = fields.find((field) => field.select);
  const [createdLogin, setCreatedLogin] = useState<{
    temporaryPassword?: string | null;
    loginCreated?: boolean;
    email?: string;
  } | null>(null);
  const selectResources = fields
    .map((field) => field.select)
    .filter((resource): resource is EntitySelectResource => Boolean(resource));
  const [selectOptions, setSelectOptions] = useState<
    Partial<Record<EntitySelectResource, { value: string; label: string }[]>>
  >({});

  const load = useCallback(() => {
    setLoading(true);
    api
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [api]);

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
  }, [selectResources.join(",")]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    // Empty optional fields: left out on create, cleared (null) on edit. A phone with no number is empty.
    const value = (key: string) => {
      const v = form[key]?.trim() ?? "";
      return key === "phone" && !splitPhone(v).number ? "" : v;
    };
    const payload = Object.fromEntries(
      fields.flatMap((f): [string, string | null][] => (value(f.key) ? [[f.key, value(f.key)]] : editingId ? [[f.key, null]] : [])),
    );
    try {
      if (editingId) {
        await api.update(editingId, payload);
        setCreatedLogin(null);
        toast(`${form.name || singular} updated`);
      } else {
        const created = await api.create(payload);
        setCreatedLogin({
          temporaryPassword: (created as { temporaryPassword?: string }).temporaryPassword,
          loginCreated: (created as { loginCreated?: boolean }).loginCreated,
          email: payload.email ?? undefined,
        });
        toast(`${form.name} added`);
      }
      setForm(emptyForm(fields));
      setEditingId(null);
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  const parentLabels = useMemo(
    () => new Map((parentField?.select ? (selectOptions[parentField.select] ?? []) : []).map((o) => [o.value, o.label])),
    [parentField, selectOptions],
  );
  // People have logins to switch off; certificates and competencies are plain records.
  const hasLogin = resource === "employees" || resource === "contractors" || resource === "agencies";
  const columns = fields.filter((f) => f.key !== "name" && f.key !== "description");
  const cell = (item: WorkforceItem, field: EntityField) => {
    const raw = String((item as Record<string, unknown>)[field.key] ?? "");
    if (!raw) return "";
    if (field.select) return (selectOptions[field.select] ?? []).find((o) => o.value === raw)?.label ?? "";
    if (isDate(field.key)) return formatDate(raw);
    return raw;
  };
  const parentOf = (item: WorkforceItem) =>
    parentField ? parentLabels.get(String((item as Record<string, unknown>)[parentField.key] ?? "")) : undefined;

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.name, "email" in item ? item.email : null, "role" in item ? item.role : null, parentOf(item)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
    // parentOf only reads parentLabels
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, parentLabels]);

  return (
    <AdminPage>
      <AdminPageHeader
        title={title}
        description={description}
        action={
          !formOpen ? (
            <Button
              type="button"
              size="lg"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm(fields));
                setCreatedLogin(null);
                setFormOpen(true);
              }}
            >
              <Plus aria-hidden />
              Add {singular}
            </Button>
          ) : null
        }
      />
      {formOpen ? (
      <form onSubmit={handleSubmit} className="reveal-in grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">{editingId ? `Edit ${form.name || singular}` : `New ${singular}`}</h2>
        {fields.map((field) => (
          <label key={field.key} className="grid gap-1.5 text-sm">
            <span className="font-medium">
              {field.label}
              {field.required ? "" : <span className="font-normal text-muted-foreground"> (optional)</span>}
            </span>
            {field.select ? (
              <select
                required={field.required}
                value={form[field.key] ?? ""}
                className={INPUT_CLASS}
                onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
              >
                <option value="">Select {field.label.toLowerCase()}</option>
                {(selectOptions[field.select] ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.key === "phone" ? (
              <PhoneInput value={form.phone ?? ""} onChange={(phone) => setForm((p) => ({ ...p, phone }))} />
            ) : (
              <input
                required={field.required}
                type={field.key === "email" ? "email" : isDate(field.key) ? "date" : "text"}
                value={form[field.key] ?? ""}
                {...(field.key === "name" ? { pattern: NAME_PATTERN, title: NAME_HINT, maxLength: 255 } : {})}
                {...(field.key === "expiryDate" && form.startDate ? { min: form.startDate } : {})}
                className={INPUT_CLASS}
                onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
              />
            )}
          </label>
        ))}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : editingId ? "Save changes" : `Add ${singular}`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFormOpen(false);
              setEditingId(null);
              setForm(emptyForm(fields));
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
      ) : null}
      {createdLogin?.temporaryPassword ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">Login created for {createdLogin.email}</p>
          <p className="mt-1 text-muted-foreground">
            Copy this temporary password now. They must change it on first sign-in.
          </p>
          <p className="mt-2 flex items-center gap-2">
            <span className="font-mono">{createdLogin.temporaryPassword}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void copyText(createdLogin.temporaryPassword ?? "").then((ok) =>
                  toast(ok ? "Temporary password copied" : "Copy failed: select the password and copy it", ok ? "success" : "error"),
                )
              }
            >
              Copy
            </Button>
          </p>
        </div>
      ) : createdLogin?.loginCreated === false ? (
        <p className="text-sm text-muted-foreground">
          This email already has a platform login. They were added to the workforce and emailed.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {items.length > 5 ? (
        <label className="relative flex h-10 items-center sm:w-80">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Search {title.toLowerCase()}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${items.length} by name, email or ${parentField?.label.toLowerCase() ?? "role"}`}
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">No {title.toLowerCase()} yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add the first {singular} so they can be assigned to permits.</p>
        </div>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="table-tone text-left text-xs">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5">Name</th>
              {columns.map((field) => (
                <th key={field.key} className="px-4 py-2.5">
                  {field.label}
                </th>
              ))}
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.id} className="row-hover border-t border-border first:border-t-0">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                {columns.map((field) => (
                  <td key={field.key} className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {cell(item, field) || <span className="text-muted-foreground/60">Not set</span>}
                  </td>
                ))}
                <td className="px-4 py-3"><OrgStatusBadge status={item.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(item.id);
                        setCreatedLogin(null);
                        setForm(Object.fromEntries(fields.map((field) => [field.key, String((item as Record<string, unknown>)[field.key] ?? "")])));
                        setFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    {!hasLogin ? null : item.status === "disabled" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!window.confirm(`Reactivate ${item.name}?`)) return;
                          void (api as typeof employeesApi)
                            .reactivate(item.id)
                            .then(() => {
                              toast(`${item.name} reactivated`);
                              load();
                            })
                            .catch((err) => setError(err instanceof ApiError ? err.message : "Reactivate failed"));
                        }}
                      >
                        Reactivate
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!window.confirm(`Deactivate ${item.name}? They stay on this list but cannot sign in.`)) return;
                          void (api as typeof employeesApi)
                            .deactivate(item.id)
                            .then(() => {
                              toast(`${item.name} deactivated`);
                              load();
                            })
                            .catch((err) => setError(err instanceof ApiError ? err.message : "Deactivate failed"));
                        }}
                      >
                        Deactivate
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm(hasLogin ? `Delete ${item.name}? This removes the row and their login.` : `Delete ${item.name}?`)) return;
                        void api
                          .archive(item.id)
                          .then(() => {
                            toast(`${item.name} deleted`);
                            load();
                          })
                          .catch((err) => setError(err instanceof ApiError ? err.message : "Delete failed"));
                      }}
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
    </AdminPage>
  );
}
