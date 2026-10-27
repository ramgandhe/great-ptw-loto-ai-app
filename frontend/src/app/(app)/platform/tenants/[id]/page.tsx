"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { OrgStatusBadge, stateOf } from "@/components/organisation/org-status-badge";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformTenantsApi, type PlatformTenantDetail } from "@/lib/platform/api";
import { copyText } from "@/lib/utils";

function addressOf(tenant: PlatformTenantDetail) {
  return [tenant.addressLine1, tenant.addressLine2, tenant.addressState, tenant.addressCountry, tenant.addressPin]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export default function PlatformTenantViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [tenant, setTenant] = useState<PlatformTenantDetail | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    platformTenantsApi
      .get(id)
      .then((detail) => {
        if (!cancelled) setTenant(detail);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load tenant");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleReset() {
    if (!tenant?.ownerEmail) return;
    if (!(await confirmAction(`Reset password for ${tenant.ownerEmail}? A new temporary password will be generated.`))) {
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const detail = await platformTenantsApi.resetOwnerPassword(id);
      setTenant(detail);
      setRevealed(true);
      toast("Password reset. Copy the new temporary password.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Password reset failed");
    } finally {
      setResetting(false);
    }
  }

  const password = tenant?.temporaryPassword ?? "";

  return (
    <AdminPage>
      <AdminPageHeader
        title={tenant?.name ?? "Tenant"}
        description="Organisation details and the owner's temporary password."
        back={{ href: "/platform/tenants", label: "Tenants" }}
        action={
          tenant ? (
            <Button type="button" onClick={() => router.push(`/platform/tenants/${id}/edit`)}>
              Edit
            </Button>
          ) : null
        }
      />

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !tenant ? null : (
        <>
          <section className="rounded-xl border border-border bg-card p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <OrgStatusBadge status={stateOf(tenant)} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Industry</dt>
                <dd className="mt-1">{tenant.industryName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Owner email</dt>
                <dd className="mt-1">{tenant.ownerEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Invite</dt>
                <dd className="mt-1">{tenant.inviteStatus ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">About</dt>
                <dd className="mt-1">{tenant.about?.trim() || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Address</dt>
                <dd className="mt-1">{addressOf(tenant) || "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Owner password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A temporary password is shown until the owner signs in and sets their own password.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">{password ? (revealed ? password : "••••••••") : "None stored"}</span>
              {password ? (
                <>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRevealed((current) => !current)}>
                    {revealed ? "Hide" : "Show"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void copyText(password).then((ok) => toast(ok ? "Temporary password copied" : "Copy failed", ok ? "success" : "error"))
                    }
                  >
                    Copy
                  </Button>
                </>
              ) : null}
              <Button type="button" size="sm" variant="outline" disabled={resetting || !tenant.ownerEmail} onClick={() => void handleReset()}>
                {resetting ? "Resetting…" : "Reset password"}
              </Button>
            </div>
          </section>
        </>
      )}
    </AdminPage>
  );
}
