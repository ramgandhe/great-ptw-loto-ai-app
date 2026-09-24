"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { platformTenantsApi, type CreatedTenant, type PlatformTenant } from "@/lib/platform/api";
import { Button } from "@/components/ui/button";

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
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
    loadTenants().finally(() => setLoading(false));
  }, []);

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
      await platformTenantsApi.disable(id);
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to disable tenant");
    } finally {
      setActingId(null);
    }
  }

  async function handleEnable(id: string) {
    setActingId(id);
    setError(null);
    try {
      await platformTenantsApi.enable(id);
      await loadTenants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to enable tenant");
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
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center gap-3">
        <Building2 className="size-6" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Invite an organisation owner. They receive a Keycloak login with the organisation-admin
            role and must change the temporary password on first sign-in.
          </p>
        </div>
      </div>

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

      <form onSubmit={handleCreate} className="grid max-w-xl gap-4 rounded-lg border border-border bg-card p-4">
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
        <h2 className="mb-3 text-sm font-semibold">Organisations</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tenants yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Owner email</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Invite</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{tenant.name}</td>
                    <td className="px-3 py-2">{tenant.ownerEmail ?? "—"}</td>
                    <td className="px-3 py-2">{tenant.status}</td>
                    <td className="px-3 py-2">{tenant.inviteStatus ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {tenant.status === "disabled" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actingId === tenant.id}
                            onClick={() => handleEnable(tenant.id)}
                          >
                            Enable
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actingId === tenant.id}
                            onClick={() => handleDisable(tenant.id)}
                          >
                            Disable
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={actingId === tenant.id}
                          onClick={() => handleDelete(tenant)}
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
      </section>
    </main>
  );
}
