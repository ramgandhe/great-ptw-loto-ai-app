"use client";

import { inUse } from "@/components/organisation/org-status-badge";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
import { toast } from "@/components/ui/toast";
import { RowActions } from "@/components/ui/row-actions";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { copyText } from "@/lib/utils";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";

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
  const [formOpen, setFormOpen] = useState(false);
  const [created, setCreated] = useState<CreatedTenantUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  function loadUsers() {
    return listTenantUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load users"));
  }

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
    departmentsApi.list().then((rows) => setDepartments(rows.filter(inUse).map((row) => ({ id: row.id, name: row.name })))).catch(() => setDepartments([]));
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
      toast(`${result.name} added as ${formatRoleLabel(result.role)}`);
      setForm({ name: "", email: "", role: "", departmentId: "" });
      setFormOpen(false);
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
      toast(`Role changed to ${formatRoleLabel(role)}`);
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
      toast(`${user.email ?? user.username} deactivated`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate user");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleReactivate(user: TenantUser) {
    const confirmed = window.confirm(`Activate ${user.email ?? user.username}?`);
    if (!confirmed) {
      return;
    }
    setUpdatingId(user.id);
    setError(null);
    try {
      await reactivateTenantUser(user.id);
      toast(`${user.email ?? user.username} activated`);
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
      toast(`${user.email ?? user.username} deleted`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Users and roles"
        description="Add people with a name, email and login role. Share the temporary password once; they change it on first sign-in."
        action={
          !formOpen ? (
            <Button
              type="button"
              size="lg"
              onClick={() => {
                setCreated(null);
                setFormOpen(true);
              }}
            >
              <Plus aria-hidden />
              Add user
            </Button>
          ) : null
        }
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
        <div role="status" className="rounded-xl border border-(--status-success)/40 bg-card p-5 text-sm">
          <p className="font-semibold">User created</p>
          <p className="mt-2 text-muted-foreground">{created.signInHint}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
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
                  onClick={() => void copyText(created.temporaryPassword).then((ok) => toast(ok ? "Temporary password copied" : "Copy failed: select the password and copy it", ok ? "success" : "error"))}
                >
                  Copy
                </Button>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {formOpen ? (
      <form onSubmit={handleCreate} className="reveal-in grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">New user</h2>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Name</span>
          <input
            required
            pattern={NAME_PATTERN}
            title={NAME_HINT}
            maxLength={255}
            value={form.name}
            className={FIELD_CLASS}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Email</span>
          <input
            required
            type="email"
            value={form.email}
            className={FIELD_CLASS}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Role</span>
          <select
            required
            value={form.role}
            className={FIELD_CLASS}
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
          <span className="font-medium">
            Department <span className="font-normal text-muted-foreground">(optional, limits what an HOD sees)</span>
          </span>
          <select
            value={form.departmentId}
            className={FIELD_CLASS}
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
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add user"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
      ) : null}

      {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
            <p className="font-medium">No users yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add the first user so they can sign in.</p>
          </div>
        ) : (
          <div className="table-box">
            <table className="min-w-full text-sm">
              <thead className="table-tone text-left text-xs">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const currentRole = user.roles[0] ?? "";
                  const canChangeRole = assignableRoles.some((option) => option.value === currentRole);
                  const manageable = canManageUser(user);
                  const busy = updatingId === user.id;
                  const editing = manageable && editingUserId === user.id;
                  return (
                    <tr key={user.id} className="row-hover border-t border-border first:border-t-0">
                      <td className="px-4 py-3">
                        <span className="block font-medium">
                          {user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username}
                        </span>
                        <span className="block text-xs text-muted-foreground">{user.email ?? user.username}</span>
                      </td>
                      <td className="px-4 py-3">
                        {editing && canChangeRole && user.enabled ? (
                          <select
                            value={currentRole}
                            disabled={busy}
                            className={FIELD_CLASS}
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
                      <td className="px-4 py-3">
                        {editing ? (
                          <select
                            value={user.departmentId ?? ""}
                            disabled={busy}
                            className={FIELD_CLASS}
                            onChange={(e) => {
                              const departmentId = e.target.value;
                              setUpdatingId(user.id);
                              updateTenantUser(user.id, { departmentId })
                                .then(() => {
                                  toast("Department updated");
                                  return loadUsers();
                                })
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
                      <td className="px-4 py-3">
                        <OrgStatusBadge status={user.enabled ? "active" : "disabled"} />
                      </td>
                      <td className="px-4 py-3">
                        {manageable ? (
                          <RowActions
                            actions={[
                              // Role and department change in place while editing; each change saves on its own.
                              { label: editing ? "Done" : "Edit", disabled: busy, onClick: () => setEditingUserId(editing ? null : user.id) },
                              user.enabled
                                ? { label: "Deactivate", disabled: busy, onClick: () => void handleDeactivate(user) }
                                : { label: "Activate", disabled: busy, onClick: () => void handleReactivate(user) },
                              { label: "Delete", danger: true, disabled: busy, onClick: () => void handleDelete(user) },
                            ]}
                          />
                        ) : (
                          <span className="sr-only">No actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </AdminPage>
  );
}
