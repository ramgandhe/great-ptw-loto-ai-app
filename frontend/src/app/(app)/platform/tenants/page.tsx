"use client";

import { PageHeader } from "@/components/layout/page-header";
import { toast } from "@/components/ui/toast";
import { RowActions } from "@/components/ui/row-actions";
import { OrgStatusBadge, stateOf } from "@/components/organisation/org-status-badge";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  accessRequestsApi,
  platformTenantsApi,
  type AccessRequest,
  type CreatedTenant,
  type PlatformTenant,
} from "@/lib/platform/api";
import { Button } from "@/components/ui/button";

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [form, setForm] = useState({
    organisationName: "",
    ownerEmail: "",
    ownerFirstName: "",
    ownerLastName: "",
  });
  const [created, setCreated] = useState<CreatedTenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

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

  function fillInviteFromRequest(request: AccessRequest) {
    const [firstName, ...rest] = request.fullName.split(" ");
    setForm({
      organisationName: request.companyName,
      ownerEmail: request.workEmail,
      ownerFirstName: firstName ?? "",
      ownerLastName: rest.join(" "),
    });
    document.getElementById("invite-form")?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      const result = await platformTenantsApi.create({
        organisationName: form.organisationName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerFirstName: form.ownerFirstName.trim() || undefined,
        ownerLastName: form.ownerLastName.trim() || undefined,
      });
      setCreated(result);
      toast(`${form.organisationName.trim()} invited`);
      setForm({ organisationName: "", ownerEmail: "", ownerFirstName: "", ownerLastName: "" });
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create tenant");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable(id: string) {
    setActingId(id);
    setError(null);
    try {
      if (!window.confirm("Deactivate this organisation? Its people cannot sign in until it is activated.")) return;
      await platformTenantsApi.disable(id);
      toast("Organisation deactivated");
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Deactivate failed");
    } finally {
      setActingId(null);
    }
  }

  async function handleEnable(id: string) {
    setActingId(id);
    setError(null);
    try {
      await platformTenantsApi.enable(id);
      toast("Organisation activated");
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Activate failed");
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(tenant: PlatformTenant) {
    const confirmed = window.confirm(
      `Permanently delete ${tenant.name}? Organisation users will lose access and this cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }
    setActingId(tenant.id);
    setError(null);
    try {
      await platformTenantsApi.remove(tenant.id);
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete tenant");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-8 px-4 pb-8 sm:px-8">
      <PageHeader
        title="Tenants"
        description="Invite an organisation owner. They receive a login with the organisation-admin role and change the temporary password on first sign-in."
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {created ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-semibold">Tenant created</p>
          <p className="mt-2 text-muted-foreground">{created.signInHint}</p>
          <dl className="mt-3 grid gap-2">
            <div>
              <dt className="text-muted-foreground">Owner email</dt>
              <dd className="font-medium">{created.ownerEmail}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Temporary password (shown once)</dt>
              <dd className="font-mono">{created.temporaryPassword}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Join link</dt>
              <dd className="break-all">{created.joinUrl}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <form id="invite-form" onSubmit={handleCreate} className="grid max-w-xl gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Invite organisation owner</h2>
        {(
          [
            ["organisationName", "Organisation name", true],
            ["ownerEmail", "Owner email", true],
            ["ownerFirstName", "Owner first name", false],
            ["ownerLastName", "Owner last name", false],
          ] as const
        ).map(([key, label, required]) => (
          <label key={key} className="grid gap-1.5 text-sm">
            <span className="font-medium">
              {label}
              {required ? " *" : ""}
            </span>
            <input
              required={required}
              type={key === "ownerEmail" ? "email" : "text"}
              {...(key === "ownerEmail" ? {} : { pattern: NAME_PATTERN, title: NAME_HINT, maxLength: 255 })}
              value={form[key]}
              className="h-9 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          </label>
        ))}
        <Button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Invite tenant"}
        </Button>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Access requests</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No access requests yet. Requests sent from the public Request access page appear here.
          </p>
        ) : (
          <div className="table-box">
            <table className="w-full text-left text-sm">
              <thead className="table-tone border-b border-border">
                <tr>
                  <th className="px-4 py-2.5">Received</th>
                  <th className="px-4 py-2.5">Company</th>
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">Sites</th>
                  <th className="px-4 py-2.5">Message</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="row-hover border-b border-border align-top last:border-0">
                    <td className="whitespace-nowrap px-3 py-2">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">{request.companyName}</td>
                    <td className="px-3 py-2">
                      <div>{request.fullName}{request.jobTitle ? `, ${request.jobTitle}` : ""}</div>
                      <div className="text-muted-foreground">{request.workEmail}</div>
                      {request.phone ? <div className="text-muted-foreground">{request.phone}</div> : null}
                    </td>
                    <td className="px-3 py-2">{request.siteCount ?? "—"}</td>
                    <td className="max-w-xs px-3 py-2 text-muted-foreground">{request.message ?? "—"}</td>
                    <td className="px-3 py-2">
                      <RowActions actions={[{ label: "Use for invite", onClick: () => fillInviteFromRequest(request) }]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Organisations</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tenants yet.</p>
        ) : (
          <div className="table-box">
            <table className="w-full text-left text-sm">
              <thead className="table-tone border-b border-border">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Owner email</th>
                  <th className="px-4 py-2.5">Invite</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="row-hover border-b border-border last:border-0">
                    <td className="px-3 py-2">{tenant.name}</td>
                    <td className="px-3 py-2">{tenant.ownerEmail ?? "—"}</td>
                    <td className="px-3 py-2">{tenant.inviteStatus ?? "—"}</td>
                    <td className="px-3 py-2">
                      <OrgStatusBadge status={stateOf(tenant)} />
                    </td>
                    <td className="px-3 py-2">
                      <RowActions
                        actions={[
                          tenant.status === "disabled"
                            ? { label: "Activate", disabled: actingId === tenant.id, onClick: () => handleEnable(tenant.id) }
                            : { label: "Deactivate", disabled: actingId === tenant.id, onClick: () => handleDisable(tenant.id) },
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
      </section>
    </main>
  );
}
