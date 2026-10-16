"use client";

import { inUse } from "@/components/organisation/org-status-badge";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { deleteWithAssignmentConfirm } from "@/lib/confirm-delete";
import { sitesApi } from "@/lib/organisation/api";
import { placeApi } from "@/lib/place/api";
import {
  createTenantUser,
  deactivateTenantUser,
  deleteTenantUser,
  listTenantUsers,
  reactivateTenantUser,
  resetTenantUserPassword,
  updateTenantUserRole,
} from "@/lib/workforce/api";
import type { CreatedTenantUser, TenantUser } from "@/lib/workforce/types";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { ASSIGNABLE_ROLES, rolesAssignableBy } from "@/lib/form-options";
import { formatRoleLabel } from "@/lib/auth/rbac";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { RowActions } from "@/components/ui/row-actions";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { copyText } from "@/lib/utils";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";
import {
  AdminPage,
  AdminPageHeader,
  FIELD_CLASS,
} from "@/components/layout/admin-page-header";

export default function UserRolesPage() {
  const { profile, roles: actorRoles } = useAuthProfile();
  const assignableRoles = ASSIGNABLE_ROLES.filter((option) =>
    rolesAssignableBy(actorRoles).includes(option.value),
  );
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    roles: [] as string[],
  });
  const [editingRoles, setEditingRoles] = useState<Record<string, string[]>>(
    {},
  );
  const [formOpen, setFormOpen] = useState(false);
  const [created, setCreated] = useState<CreatedTenantUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<
    Record<string, boolean>
  >({});
  const [sitesByUser, setSitesByUser] = useState<Record<string, string[]>>({});

  function loadUsers() {
    return listTenantUsers()
      .then(setUsers)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Failed to load users",
        ),
      );
  }

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
    sitesApi
      .list()
      .then(async (sites) => {
        const groups = await Promise.all(
          sites.filter(inUse).map(async (site) => ({
            name: site.name,
            members: await placeApi.listMembers(site.id).catch(() => []),
          })),
        );
        const next: Record<string, string[]> = {};
        for (const group of groups) {
          for (const member of group.members) {
            (next[member.userId] ??= []).push(group.name);
          }
        }
        setSitesByUser(next);
      })
      .catch(() => setSitesByUser({}));
  }, []);

  function canManageUser(user: TenantUser) {
    if (!profile?.id || user.id === profile.id) {
      return false;
    }
    const allowed = rolesAssignableBy(actorRoles);
    return (
      user.roles.length > 0 &&
      user.roles.every((role) => allowed.includes(role))
    );
  }

  function toggleFormRole(role: string) {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((entry) => entry !== role)
        : [...prev.roles, role],
    }));
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (form.roles.length === 0) {
      setError("Select at least one role");
      return;
    }
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      const result = await createTenantUser({
        name: form.name.trim(),
        email: form.email.trim(),
        roles: form.roles,
      });
      setCreated(result);
      toast(
        `${result.name} added as ${(result.roles ?? [result.role]).map(formatRoleLabel).join(", ")}`,
      );
      setForm({ name: "", email: "", roles: [] });
      setFormOpen(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleSave(userId: string, roles: string[]) {
    if (roles.length === 0) {
      setError("Select at least one role");
      return;
    }
    const confirmed = await confirmAction(
      `Change this user's roles to ${roles.map(formatRoleLabel).join(", ")}?`,
    );
    if (!confirmed) {
      await loadUsers();
      return;
    }
    setUpdatingId(userId);
    setError(null);
    try {
      await updateTenantUserRole(userId, roles);
      toast(`Roles updated to ${roles.map(formatRoleLabel).join(", ")}`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeactivate(user: TenantUser) {
    const confirmed = await confirmAction(
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
      setError(
        err instanceof ApiError ? err.message : "Failed to deactivate user",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleReactivate(user: TenantUser) {
    const confirmed = await confirmAction(
      `Activate ${user.email ?? user.username}?`,
    );
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
      setError(
        err instanceof ApiError ? err.message : "Failed to reactivate user",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(user: TenantUser) {
    const label = user.email ?? user.username;
    setUpdatingId(user.id);
    setError(null);
    try {
      const ok = await deleteWithAssignmentConfirm(label, (force) =>
        deleteTenantUser(user.id, force).then(() => undefined),
      );
      if (!ok) return;
      toast(`${label} deleted`);
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
        <div
          role="status"
          className="rounded-xl border border-(--status-success)/40 bg-card p-5 text-sm"
        >
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
              <dd className="font-medium">
                {(created.roles ?? [created.role])
                  .map(formatRoleLabel)
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Temporary password</dt>
              <dd className="flex items-center gap-2">
                <span className="font-mono">{created.temporaryPassword}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void copyText(created.temporaryPassword).then((ok) =>
                      toast(
                        ok
                          ? "Temporary password copied"
                          : "Copy failed: select the password and copy it",
                        ok ? "success" : "error",
                      ),
                    )
                  }
                >
                  Copy
                </Button>
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {formOpen ? (
        <form
          onSubmit={handleCreate}
          className="reveal-in grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
        >
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
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Email</span>
            <input
              required
              type="email"
              value={form.email}
              className={FIELD_CLASS}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </label>
          <fieldset className="grid gap-1.5 text-sm sm:col-span-2">
            <legend className="font-medium">Roles</legend>
            <p className="text-muted-foreground">
              A person can hold more than one role, for example Permit receiver
              and Permit operator.
            </p>
            <div className="flex flex-wrap gap-3">
              {assignableRoles.map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(option.value)}
                    onChange={() => toggleFormRole(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving || form.roles.length === 0}>
              {saving ? "Adding…" : "Add user"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFormOpen(false)}
            >
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
          <p className="mt-1 text-sm text-muted-foreground">
            Add the first user so they can sign in.
          </p>
        </div>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Roles</th>
                <th className="px-4 py-2.5">Sites</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Password</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const selectedRoles = editingRoles[user.id] ?? user.roles;
                const canChangeRole = user.roles.every((role) =>
                  assignableRoles.some((option) => option.value === role),
                );
                const manageable = canManageUser(user);
                const busy = updatingId === user.id;
                const editing = manageable && editingUserId === user.id;
                return (
                  <tr
                    key={user.id}
                    className="row-hover border-t border-border first:border-t-0"
                  >
                    <td className="px-4 py-3">
                      <span className="block font-medium">
                        {user.name ||
                          [user.firstName, user.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          user.username}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {user.email ?? user.username}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editing && canChangeRole && user.enabled ? (
                        <div className="grid gap-2">
                          {assignableRoles.map((option) => (
                            <label
                              key={option.value}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                disabled={busy}
                                checked={selectedRoles.includes(option.value)}
                                onChange={() => {
                                  setEditingRoles((prev) => {
                                    const current = prev[user.id] ?? user.roles;
                                    const next = current.includes(option.value)
                                      ? current.filter(
                                          (entry) => entry !== option.value,
                                        )
                                      : [...current, option.value];
                                    return { ...prev, [user.id]: next };
                                  });
                                }}
                              />
                              {option.label}
                            </label>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void handleRoleSave(user.id, selectedRoles)
                            }
                          >
                            Save roles
                          </Button>
                        </div>
                      ) : (
                        user.roles.map(formatRoleLabel).join(", ")
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.roles.some(
                        (role) =>
                          role === "tenant-owner" ||
                          role === "tenant-admin" ||
                          role === "org-admin" ||
                          role === "platform-admin",
                      )
                        ? "All sites"
                        : sitesByUser[user.id]?.join(", ") || "No sites"}
                    </td>
                    <td className="px-4 py-3">
                      <OrgStatusBadge
                        status={user.enabled ? "active" : "disabled"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {user.temporaryPassword ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs">
                            {revealedPasswordIds[user.id]
                              ? user.temporaryPassword
                              : "••••••••"}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              setRevealedPasswordIds((current) => ({
                                ...current,
                                [user.id]: !current[user.id],
                              }))
                            }
                          >
                            {revealedPasswordIds[user.id] ? "Hide" : "Show"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void copyText(user.temporaryPassword ?? "").then(
                                (ok) =>
                                  toast(
                                    ok
                                      ? "Temporary password copied"
                                      : "Copy failed",
                                    ok ? "success" : "error",
                                  ),
                              )
                            }
                          >
                            Copy
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {manageable ? (
                        <RowActions
                          actions={[
                            // Role and department change in place while editing; each change saves on its own.
                            {
                              label: editing ? "Done" : "Edit",
                              disabled: busy,
                              onClick: () => {
                                if (editing) {
                                  setEditingUserId(null);
                                  return;
                                }
                                setEditingRoles((prev) => ({
                                  ...prev,
                                  [user.id]: user.roles,
                                }));
                                setEditingUserId(user.id);
                              },
                            },
                            {
                              label: "Reset password",
                              disabled: busy,
                              onClick: async () => {
                                if (
                                  !(await confirmAction(
                                    `Reset password for ${user.email ?? user.username}? A new temporary password will be generated.`,
                                  ))
                                ) {
                                  return;
                                }
                                setUpdatingId(user.id);
                                resetTenantUserPassword(user.id)
                                  .then((next) => {
                                    toast(
                                      "Password reset. Copy the new temporary password.",
                                    );
                                    setRevealedPasswordIds((current) => ({
                                      ...current,
                                      [user.id]: true,
                                    }));
                                    setUsers((current) =>
                                      current.map((row) =>
                                        row.id === next.id ? next : row,
                                      ),
                                    );
                                  })
                                  .catch((err) =>
                                    setError(
                                      err instanceof ApiError
                                        ? err.message
                                        : "Failed to reset password",
                                    ),
                                  )
                                  .finally(() => setUpdatingId(null));
                              },
                            },
                            user.enabled
                              ? {
                                  label: "Deactivate",
                                  disabled: busy,
                                  onClick: () => void handleDeactivate(user),
                                }
                              : {
                                  label: "Activate",
                                  disabled: busy,
                                  onClick: () => void handleReactivate(user),
                                },
                            {
                              label: "Delete",
                              danger: true,
                              disabled: busy,
                              onClick: () => void handleDelete(user),
                            },
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
