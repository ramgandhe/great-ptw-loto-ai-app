"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppSelect } from "@/components/ui/select";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { ASSIGNABLE_ROLES, rolesAssignableBy } from "@/lib/form-options";
import { departmentsApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { inUse } from "@/components/organisation/org-status-badge";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";
import { listTenantUsers, updateTenantUser, updateTenantUserRole } from "@/lib/workforce/api";
import type { TenantUser } from "@/lib/workforce/types";
import { formatRoleLabel } from "@/lib/auth/rbac";

function displayName(user: TenantUser) {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
}

export default function WorkforceUserEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { profile, roles: actorRoles } = useAuthProfile();
  const assignableRoles = ASSIGNABLE_ROLES.filter((option) => rolesAssignableBy(actorRoles).includes(option.value));
  const [user, setUser] = useState<TenantUser | null>(null);
  const [departments, setDepartments] = useState<OrgRecord[]>([]);
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listTenantUsers(), departmentsApi.list().catch(() => [])])
      .then(([users, departmentRows]) => {
        if (cancelled) return;
        const found = users.find((row) => row.id === id) ?? null;
        setUser(found);
        setDepartments(departmentRows.filter((row) => inUse(row) || row.id === found?.departmentId));
        if (!found) {
          setError("This user was not found.");
          return;
        }
        setName(displayName(found));
        setDepartmentId(found.departmentId ?? "");
        setSelectedRoles(found.roles);
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
  const canChangeRole = Boolean(user?.enabled && user.roles.every((role) => assignableRoles.some((option) => option.value === role)));
  const back = { href: `/workforce/roles/${id}`, label: user ? displayName(user) : "User" };

  function toggleRole(role: string) {
    setSelectedRoles((current) => (current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role]));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    const rolesChanged = canChangeRole && selectedRoles.slice().sort().join() !== user.roles.slice().sort().join();
    if (rolesChanged && !(await confirmAction(`Change this user's roles to ${selectedRoles.map(formatRoleLabel).join(", ")}?`))) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTenantUser(user.id, { name: name.trim(), departmentId });
      if (rolesChanged) {
        await updateTenantUserRole(user.id, selectedRoles);
      }
      toast(`${name.trim()} updated`);
      router.push(back.href);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader title="Edit user" description="Name, department, and roles. Email stays the login." back={back} />
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !user ? null : !manageable ? (
        <p className="text-sm text-muted-foreground">You cannot edit this user.</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid max-w-3xl gap-4 rounded-xl border border-border bg-card p-5">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <input
              required
              autoFocus
              pattern={NAME_PATTERN}
              title={NAME_HINT}
              maxLength={255}
              value={name}
              className={FIELD_CLASS}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Email</span>
            <input disabled value={user.email ?? user.username} className={FIELD_CLASS} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">
              Department<span className="font-normal text-muted-foreground"> (optional)</span>
            </span>
            <AppSelect value={departmentId} className={FIELD_CLASS} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </AppSelect>
          </label>
          {canChangeRole ? (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Roles</legend>
              {assignableRoles.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={saving} checked={selectedRoles.includes(option.value)} onChange={() => toggleRole(option.value)} />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-muted-foreground">Roles: {user.roles.map(formatRoleLabel).join(", ")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || !name.trim() || (canChangeRole && selectedRoles.length === 0)}>
              {saving ? "Saving…" : "Save user"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push(back.href)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </AdminPage>
  );
}
