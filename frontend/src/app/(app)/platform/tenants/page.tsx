"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { toast } from "@/components/ui/toast";
import { RowActions } from "@/components/ui/row-actions";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { OrgStatusBadge, stateOf } from "@/components/organisation/org-status-badge";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  accessRequestsApi,
  platformTenantsApi,
  type AccessRequest,
  type CreatedTenant,
  type PlatformTenant,
} from "@/lib/platform/api";
import { Button } from "@/components/ui/button";

const EMPTY_FORM = { organisationName: "", ownerEmail: "", ownerFirstName: "", ownerLastName: "" };

const FORM_FIELDS = [
  ["organisationName", "Organisation name", true],
  ["ownerEmail", "Owner email", true],
  ["ownerFirstName", "Owner first name", false],
  ["ownerLastName", "Owner last name", false],
] as const;

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [created, setCreated] = useState<CreatedTenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [view, setView] = useState<"organisations" | "requests">("organisations");
  const [query, setQuery] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function loadTenants() {
    return platformTenantsApi
      .list()
      .then(setTenants)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load tenants"));
  }

  useEffect(() => {
    const loadRequests = accessRequestsApi
      .list()
      .then(setRequests)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load access requests"));
    Promise.all([loadTenants(), loadRequests]).finally(() => setLoading(false));
  }, []);

  const visibleTenants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tenants.filter((t) => [t.name, t.ownerEmail].some((v) => v?.toLowerCase().includes(q))) : tenants;
  }, [tenants, query]);

  function openForm(prefill = EMPTY_FORM) {
    setForm(prefill);
    setCreated(null);
    setFormOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function closeForm() {
    setForm(EMPTY_FORM);
    setFormOpen(false);
  }

  function inviteFromRequest(request: AccessRequest) {
    const [firstName, ...rest] = request.fullName.split(" ");
    openForm({
      organisationName: request.companyName,
      ownerEmail: request.workEmail,
      ownerFirstName: firstName ?? "",
      ownerLastName: rest.join(" "),
    });
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await platformTenantsApi.create({
        organisationName: form.organisationName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerFirstName: form.ownerFirstName.trim() || undefined,
        ownerLastName: form.ownerLastName.trim() || undefined,
      });
      toast(`${form.organisationName.trim()} invited`);
      closeForm();
      setCreated(result);
      setView("organisations");
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create tenant");
    } finally {
      setSaving(false);
    }
  }

  async function act(tenant: PlatformTenant, run: () => Promise<unknown>, done: string, failed: string) {
    setActingId(tenant.id);
    setError(null);
    try {
      await run();
      toast(`${tenant.name} ${done}`);
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failed);
    } finally {
      setActingId(null);
    }
  }

  function handleDeactivate(tenant: PlatformTenant) {
    if (!window.confirm(`Deactivate ${tenant.name}? Its people cannot sign in until it is activated.`)) return;
    void act(tenant, () => platformTenantsApi.disable(tenant.id), "deactivated", "Deactivate failed");
  }

  function handleDelete(tenant: PlatformTenant) {
    if (!window.confirm(`Permanently delete ${tenant.name}? Organisation users will lose access and this cannot be undone.`)) return;
    void act(tenant, () => platformTenantsApi.remove(tenant.id), "deleted", "Delete failed");
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Tenants"
        description="Invite an organisation owner. They get the organisation-admin role and choose their own password on first sign-in."
        action={
          !formOpen ? (
            <Button type="button" size="lg" onClick={() => openForm()}>
              <Plus aria-hidden />
              Invite organisation
            </Button>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedToggle
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: "organisations", label: "Organisations", count: tenants.length },
              { value: "requests", label: "Access requests", count: requests.length },
            ]}
          />
          {view === "organisations" && tenants.length > 5 ? (
            <label className="relative flex h-10 items-center sm:w-80">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
              <span className="sr-only">Search organisations</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${tenants.length} organisations`}
                className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
          ) : null}
        </div>
      </AdminPageHeader>

      {created ? (
        <div role="status" className="reveal-in rounded-xl border border-border bg-card p-5 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{created.ownerEmail} invited</p>
              <p className="mt-1 text-muted-foreground">{created.signInHint}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreated(null)}>
              Dismiss
            </Button>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Temporary password (shown once)</dt>
              <dd className="mt-0.5 font-mono">{created.temporaryPassword}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Join link</dt>
              <dd className="mt-0.5 break-all">{created.joinUrl}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {formOpen ? (
        <form
          ref={formRef}
          onSubmit={handleCreate}
          className="reveal-in grid scroll-mt-[calc(4.5rem+var(--page-head-h,0px))] gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
        >
          <h2 className="font-semibold sm:col-span-2">Invite organisation owner</h2>
          {FORM_FIELDS.map(([key, label, required]) => (
            <label key={key} className="grid gap-1.5 text-sm">
              <span className="font-medium">
                {label}
                {required ? "" : <span className="font-normal text-muted-foreground"> (optional)</span>}
              </span>
              <input
                required={required}
                autoFocus={key === "organisationName"}
                type={key === "ownerEmail" ? "email" : "text"}
                {...(key === "ownerEmail" ? {} : { pattern: NAME_PATTERN, title: NAME_HINT, maxLength: 255 })}
                value={form[key]}
                className={FIELD_CLASS}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Inviting…" : "Invite organisation"}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
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
      ) : view === "requests" ? (
        requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
            <p className="font-medium">No access requests yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Requests sent from the public Request access page appear here.</p>
          </div>
        ) : (
          <div className="table-box">
            <table className="min-w-full text-sm">
              <thead className="table-tone text-left text-xs">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-medium">Company</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Sites</th>
                  <th className="px-4 py-2.5 font-medium">Message</th>
                  <th className="px-4 py-2.5 font-medium">Received</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="row-hover border-t border-border align-top first:border-t-0">
                    <td className="px-4 py-3 font-medium">{request.companyName}</td>
                    <td className="px-4 py-3">
                      <div>
                        {request.fullName}
                        {request.jobTitle ? `, ${request.jobTitle}` : ""}
                      </div>
                      <div className="text-muted-foreground">{request.workEmail}</div>
                      {request.phone ? <div className="text-muted-foreground">{request.phone}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{request.siteCount ?? ""}</td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">{request.message ?? ""}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(request.createdAt)}</td>
                    <td className="px-4 py-3">
                      <RowActions actions={[{ label: "Invite", onClick: () => inviteFromRequest(request) }]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : tenants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">No organisations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Invite the first organisation owner to get them started.</p>
        </div>
      ) : visibleTenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Owner email</th>
                <th className="px-4 py-2.5 font-medium">Invite</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleTenants.map((tenant) => (
                <tr key={tenant.id} className="row-hover border-t border-border first:border-t-0">
                  <td className="px-4 py-3 font-medium">{tenant.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{tenant.ownerEmail ?? ""}</td>
                  <td className="px-4 py-3 text-muted-foreground">{tenant.inviteStatus ?? ""}</td>
                  <td className="px-4 py-3">
                    <OrgStatusBadge status={stateOf(tenant)} />
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        tenant.status === "disabled"
                          ? {
                              label: "Activate",
                              disabled: actingId === tenant.id,
                              onClick: () => void act(tenant, () => platformTenantsApi.enable(tenant.id), "activated", "Activate failed"),
                            }
                          : { label: "Deactivate", disabled: actingId === tenant.id, onClick: () => handleDeactivate(tenant) },
                        { label: "Delete", danger: true, disabled: actingId === tenant.id, onClick: () => handleDelete(tenant) },
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
