"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { inUse, OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { formatRoleLabel } from "@/lib/auth/rbac";
import { deleteWithAssignmentConfirm } from "@/lib/confirm-delete";
import { rolesAssignableBy } from "@/lib/form-options";
import { departmentsApi, sitesApi } from "@/lib/organisation/api";
import { placeApi } from "@/lib/place/api";
import {
  deactivateTenantUser,
  deleteTenantUser,
  listTenantUsers,
  reactivateTenantUser,
  resetTenantUserPassword,
} from "@/lib/workforce/api";
import type { TenantUser } from "@/lib/workforce/types";
import { copyText } from "@/lib/utils";

function displayName(user: TenantUser) {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
}

function coversAllSites(roles: string[]) {
  return roles.some((role) => role === "tenant-owner" || role === "tenant-admin" || role === "org-admin" || role === "platform-admin");
}

export default function WorkforceUserViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { profile, roles: actorRoles } = useAuthProfile();
  const [user, setUser] = useState<TenantUser | null>(null);
  const [sites, setSites] = useState<string[]>([]);
  const [departmentName, setDepartmentName] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function applyUser(next: TenantUser) {
    setUser(next);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listTenantUsers(),
      departmentsApi.list().catch(() => []),
      sitesApi.list().then(async (rows) => {
        const groups = await Promise.all(
          rows.filter(inUse).map(async (site) => ({
            name: site.name,
            members: await placeApi.listMembers(site.id).catch(() => []),
          })),
        );
        return groups.filter((group) => group.members.some((member) => member.userId === id)).map((group) => group.name);
      }),
    ])
      .then(([users, departmentRows, siteNames]) => {
        if (cancelled) return;
        const found = users.find((row) => row.id === id) ?? null;
        setUser(found);
        setDepartmentName(departmentRows.find((department) => department.id === found?.departmentId)?.name ?? "");
        setSites(siteNames);
        if (!found) setError("This user was not found.");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load user");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const manageable = Boolean(
    user && profile?.id && user.id !== profile.id && user.roles.length > 0 && user.roles.every((role) => rolesAssignableBy(actorRoles).includes(role)),
  );
  const password = user?.temporaryPassword ?? "";

  async function resetPassword() {
    if (!user) return;
    if (!(await confirmAction(`Reset password for ${user.email ?? user.username}? A new temporary password will be generated.`))) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await resetTenantUserPassword(user.id);
      applyUser(next);
      setRevealed(true);
      toast("Password reset. Copy the new temporary password.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password");
    } finally {
      setBusy(false);
    }
  }

  async function setEnabled(enabled: boolean) {
    if (!user) return;
    const label = user.email ?? user.username;
    const confirmed = enabled
      ? await confirmAction(`Activate ${label}?`)
      : await confirmAction(`Deactivate ${label}? They will not be able to sign in until reactivated.`);
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const next = enabled ? await reactivateTenantUser(user.id) : await deactivateTenantUser(user.id);
      applyUser({ ...user, ...next, temporaryPassword: next.temporaryPassword ?? user.temporaryPassword });
      toast(`${label} ${enabled ? "activated" : "deactivated"}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : enabled ? "Failed to reactivate user" : "Failed to deactivate user");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser() {
    if (!user) return;
    const label = user.email ?? user.username;
    setBusy(true);
    setError(null);
    try {
      const ok = await deleteWithAssignmentConfirm(label, (force) => deleteTenantUser(user.id, force).then(() => undefined));
      if (!ok) return;
      toast(`${label} deleted`);
      router.push("/workforce/roles");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title={user ? displayName(user) : "User"}
        description="Roles, sites, and the temporary password."
        back={{ href: "/workforce/roles", label: "Users and roles" }}
        action={
          manageable ? (
            <Button type="button" onClick={() => router.push(`/workforce/roles/${id}/edit`)}>
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
      ) : !user ? null : (
        <>
          <section className="rounded-xl border border-border bg-card p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="mt-1">{user.email ?? user.username}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <OrgStatusBadge status={user.enabled ? "active" : "disabled"} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Roles</dt>
                <dd className="mt-1">{user.roles.map(formatRoleLabel).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Department</dt>
                <dd className="mt-1">{departmentName || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sites</dt>
                <dd className="mt-1">{coversAllSites(user.roles) ? "All sites" : sites.join(", ") || "No sites"}</dd>
              </div>
            </dl>
            {manageable ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {user.enabled ? (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void setEnabled(false)}>
                    Deactivate
                  </Button>
                ) : (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void setEnabled(true)}>
                    Activate
                  </Button>
                )}
                <Button type="button" variant="destructive" disabled={busy} onClick={() => void removeUser()}>
                  Delete
                </Button>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Temporary password</h2>
            <p className="mt-1 text-sm text-muted-foreground">Shown until this person signs in and sets their own password.</p>
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
                    onClick={() => void copyText(password).then((ok) => toast(ok ? "Temporary password copied" : "Copy failed", ok ? "success" : "error"))}
                  >
                    Copy
                  </Button>
                </>
              ) : null}
              {manageable ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void resetPassword()}>
                  Reset password
                </Button>
              ) : null}
            </div>
          </section>
        </>
      )}
    </AdminPage>
  );
}
