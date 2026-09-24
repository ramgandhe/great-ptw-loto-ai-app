"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { departmentsApi } from "@/lib/organisation/api";
import {
  createTenantUser,
  deactivateTenantUser,
  deleteTenantUser,
  listTenantUsers,
  reactivateTenantUser,
  updateTenantUser,
  updateTenantUserRole,
} from "@/lib/workforce/api";
import type { CreatedTenantUser, TenantUser } from "@/lib/workforce/types";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { ASSIGNABLE_ROLES, rolesAssignableBy } from "@/lib/form-options";
import { formatRoleLabel } from "@/lib/auth/rbac";
import { Button } from "@/components/ui/button";

export default function UserRolesPage() {
  const { profile, roles: actorRoles } = useAuthProfile();
  const assignableRoles = ASSIGNABLE_ROLES.filter((option) =>
    rolesAssignableBy(actorRoles).includes(option.value),
  );
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    departmentId: "",
  });
  const [created, setCreated] = useState<CreatedTenantUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  function loadUsers() {
    return listTenantUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load users"));
  }

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
    departmentsApi.list().then((rows) => setDepartments(rows.map((row) => ({ id: row.id, name: row.name })))).catch(() => setDepartments([]));
  }, []);

  function canManageUser(user: TenantUser) {
    const targetRole = user.roles[0] ?? "";
    if (!profile?.id || user.id === profile.id) {
      return false;
    }
    return rolesAssignableBy(actorRoles).includes(targetRole);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      const result = await createTenantUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        departmentId: form.departmentId || undefined,
      });
      setCreated(result);
      setForm({ name: "", email: "", role: "", departmentId: "" });
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    const confirmed = window.confirm(`Change this user's role to ${formatRoleLabel(role)}?`);
    if (!confirmed) {
      await loadUsers();
      return;
    }
    setUpdatingId(userId);
    setError(null);
    try {
      await updateTenantUserRole(userId, role);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeactivate(user: TenantUser) {
    const confirmed = window.confirm(
      `Deactivate ${user.email ?? user.username}? They will not be able to sign in until reactivated.`,
    );
    if (!confirmed) {
      return;
    }
    setUpdatingId(user.id);
    setError(null);
    try {
      await deactivateTenantUser(user.id);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate user");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleReactivate(user: TenantUser) {
    const confirmed = window.confirm(`Reactivate ${user.email ?? user.username}?`);
    if (!confirmed) {
      return;
    }
    setUpdatingId(user.id);
    setError(null);
    try {
      await reactivateTenantUser(user.id);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reactivate user");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(user: TenantUser) {
    const confirmed = window.confirm(
      `Permanently delete ${user.email ?? user.username}? This cannot be undone. Historical records will be kept.`,
    );
    if (!confirmed) {
      return;
    }
    setUpdatingId(user.id);
    setError(null);
    try {
      await deleteTenantUser(user.id);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users and roles</h1>
          <p className="text-sm text-muted-foreground">
            Add people to this organisation with a name, email, and login role. Share the
            temporary password once; they must change it on first sign-in.
          </p>
        </div>
        <Link href="/workforce">
          <Button variant="outline">Back</Button>
        </Link>
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
          <p className="font-semibold">User created</p>
          <p className="mt-2 text-muted-foreground">{created.signInHint}</p>
          <dl className="mt-3 grid gap-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{created.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{created.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{formatRoleLabel(created.role)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Temporary password (shown once)</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono">{created.temporaryPassword}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(created.temporaryPassword)}
                >
                  Copy
                </Button>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <form onSubmit={handleCreate} className="grid max-w-md gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Add user</h2>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Name *</span>
          <input
            required
            value={form.name}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Email *</span>
          <input
            required
            type="email"
            value={form.email}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Role *</span>
          <select
            required
            value={form.role}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
          >
            <option value="">Select role</option>
            {assignableRoles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Department (optional, used for HOD permit visibility)</span>
          <select
            value={form.departmentId}
            className="h-9 rounded-lg border border-border bg-background px-3"
            onChange={(e) => setForm((prev) => ({ ...prev, departmentId: e.target.value }))}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Add user"}
        </Button>
      </form>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Organisation users</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users in this tenant yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const currentRole = user.roles[0] ?? "";
                  const canChangeRole = assignableRoles.some((option) => option.value === currentRole);
                  const manageable = canManageUser(user);
                  const busy = updatingId === user.id;
                  return (
                    <tr key={user.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{user.email ?? user.username}</td>
                      <td className="px-3 py-2">
                        {user.name ||
                          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                          "—"}
                      </td>
                      <td className="px-3 py-2">
                        {user.enabled ? (
                          <span className="text-foreground">Active</span>
                        ) : (
                          <span className="text-muted-foreground">Inactive</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canChangeRole && user.enabled ? (
                          <select
                            value={currentRole}
                            disabled={busy}
                            className="h-9 rounded-lg border border-border bg-background px-3"
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          >
                            {assignableRoles.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          formatRoleLabel(currentRole)
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {manageable ? (
                          <select
                            value={user.departmentId ?? ""}
                            disabled={busy}
                            className="h-9 rounded-lg border border-border bg-background px-3"
                            onChange={(e) => {
                              const departmentId = e.target.value;
                              setUpdatingId(user.id);
                              updateTenantUser(user.id, { departmentId })
                                .then(() => loadUsers())
                                .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to update department"))
                                .finally(() => setUpdatingId(null));
                            }}
                          >
                            <option value="">All departments</option>
                            {departments.map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          departments.find((department) => department.id === user.departmentId)?.name || "All"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {manageable ? (
                          <div className="flex flex-wrap gap-2">
                            {user.enabled ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => void handleDeactivate(user)}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => void handleReactivate(user)}
                              >
                                Reactivate
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={busy}
                              onClick={() => void handleDelete(user)}
                            >
                              Delete
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
