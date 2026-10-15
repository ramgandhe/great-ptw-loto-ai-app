"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { sitesApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { placeApi, type SiteMember } from "@/lib/place/api";
import { listTenantUsers } from "@/lib/workforce/api";
import type { TenantUser } from "@/lib/workforce/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";

const PRIVILEGED = new Set(["tenant-owner", "tenant-admin", "org-admin", "platform-admin"]);

function personName(user: TenantUser): string {
  return user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.username;
}

function seesAllSites(user: TenantUser): boolean {
  return user.roles.some((role) => PRIVILEGED.has(role));
}

export function SitePeople() {
  const [sites, setSites] = useState<OrgRecord[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [siteId, setSiteId] = useState("");
  const [members, setMembers] = useState<SiteMember[]>([]);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([sitesApi.list(), listTenantUsers()])
      .then(([siteRows, userRows]) => {
        const active = siteRows.filter((site) => site.status !== "archived");
        setSites(active);
        setUsers(userRows.filter((user) => user.enabled));
        setSiteId((current) => current || active[0]?.id || "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load site people"));
  }, []);

  useEffect(() => {
    if (!siteId) {
      setMembers([]);
      return;
    }
    placeApi
      .listMembers(siteId)
      .then(setMembers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load site people"));
  }, [siteId]);

  const byId = new Map(users.map((user) => [user.id, user]));
  const memberIds = new Set(members.map((member) => member.userId));
  const candidates = users.filter((user) => !seesAllSites(user) && !memberIds.has(user.id));

  async function addMember() {
    if (!siteId || !userId) return;
    setBusy(true);
    setError(null);
    try {
      await placeApi.addMember(siteId, userId);
      setMembers(await placeApi.listMembers(siteId));
      setUserId("");
      toast("Person added to this site");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add this person");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberUserId: string) {
    const name = byId.get(memberUserId) ? personName(byId.get(memberUserId)!) : memberUserId;
    if (!window.confirm(`Remove ${name} from this site?`)) return;
    setBusy(true);
    setError(null);
    try {
      await placeApi.removeMember(siteId, memberUserId);
      setMembers(await placeApi.listMembers(siteId));
      toast("Person removed from this site");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to remove this person";
      if (err instanceof ApiError && message.includes("no approver")) {
        const names = Array.isArray(err.details) ? err.details.map(String).join(", ") : "";
        const proceed = window.confirm(
          `${message}${names ? `\n\n${names}` : ""}\n\nRemove them anyway?`,
        );
        if (proceed) {
          try {
            await placeApi.removeMember(siteId, memberUserId, true);
            setMembers(await placeApi.listMembers(siteId));
            toast("Person removed from this site");
            return;
          } catch (retry) {
            setError(retry instanceof ApiError ? retry.message : "Failed to remove this person");
            return;
          }
        }
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-semibold">People</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Who may work at a site. Owners and tenant admins already see every site.
        </p>
      </div>
      {sites.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add a site before assigning people.</p>
      ) : (
        <>
          <label className="grid max-w-sm gap-1.5 text-sm">
            <span className="font-medium">Site</span>
            <select className={FIELD_CLASS} value={siteId} onChange={(event) => setSiteId(event.target.value)}>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is assigned to this site yet.</p>
          ) : (
            <ul className="grid gap-2">
              {members.map((member) => {
                const user = byId.get(member.userId);
                return (
                  <li key={member.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{user ? personName(user) : member.userId}</span>
                    <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void removeMember(member.userId)}>
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-56 flex-1 gap-1.5 text-sm">
              <span className="font-medium">Add a person</span>
              <select className={FIELD_CLASS} value={userId} onChange={(event) => setUserId(event.target.value)}>
                <option value="">Select a person</option>
                {candidates.map((user) => (
                  <option key={user.id} value={user.id}>
                    {personName(user)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" disabled={busy || !userId} onClick={() => void addMember()}>
              Add
            </Button>
          </div>
        </>
      )}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </section>
  );
}
