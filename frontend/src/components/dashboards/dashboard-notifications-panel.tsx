"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ApiError } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { listNotifications, markNotificationRead } from "@/lib/notifications/api";
import type { Notification } from "@/lib/notifications/types";
import { notificationTarget } from "@/lib/notifications/routes";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

const VISIBLE_GROUPS = 4;

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-(--status-danger)",
  high: "bg-(--vivid-4)",
  medium: "bg-(--status-warning)",
  low: "bg-muted-foreground",
};

type Group = { key: string; latest: Notification; ids: string[]; unread: string[] };

/** Recent messages with repeats collapsed, newest first. The full inbox lives on Notifications. */
export function DashboardNotificationsPanel({ limit = VISIBLE_GROUPS, inbox = false }: { limit?: number; inbox?: boolean } = {}) {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    listNotifications()
      .then((list) => {
        setNotifications(list);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Messages could not be loaded."));
  }, [attempt]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    const sorted = [...(notifications ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const n of sorted) {
      // Only true repeats collapse (same message, same record), so every line opens its own record.
      const key = `${n.title}|${n.body}|${n.entityType ?? ""}|${n.entityId ?? ""}`;
      const group = map.get(key) ?? { key, latest: n, ids: [], unread: [] };
      group.ids.push(n.id);
      if (n.readAt === null) group.unread.push(n.id);
      map.set(key, group);
    }
    // Unread first, then most recent.
    return [...map.values()].sort((a, b) => Number(b.unread.length > 0) - Number(a.unread.length > 0));
  }, [notifications]);

  async function markRead(group: Group) {
    try {
      const updated = await Promise.all(group.unread.map((id) => markNotificationRead(id)));
      const byId = new Map(updated.map((n) => [n.id, n]));
      setNotifications((current) => current?.map((n) => byId.get(n.id) ?? n) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark as read. Try again.");
    }
  }

  const unread = groups.reduce((n, g) => n + g.unread.length, 0);

  return (
    <section aria-labelledby="messages-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          {inbox ? null : (
            <h2 id="messages-heading" className="text-lg font-semibold">
              Messages
            </h2>
          )}
          <p className="text-sm text-muted-foreground">
            {notifications === null ? (error ? "Not loaded." : "Loading…") : unread === 0 ? "Nothing unread." : `${unread} unread.`}
          </p>
        </div>
        {!inbox && groups.length > limit ? (
          <Link href="/notifications" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            All {groups.length} messages
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mb-3 flex flex-wrap items-center gap-3 text-sm text-destructive">
          {error}
          {notifications === null ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Button>
          ) : null}
        </p>
      ) : null}

      {notifications === null ? null : groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
          No messages yet. Approvals, clashes and reminders will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {groups.slice(0, limit).map((group) => {
            const n = group.latest;
            const target = notificationTarget(n);
            const isUnread = group.unread.length > 0;
            const read = () => isUnread && void markRead(group);
            return (
              <li key={group.key} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", isUnread ? PRIORITY_DOT[n.priority] : "bg-transparent")}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", isUnread ? "font-semibold" : "font-medium text-muted-foreground")}>
                    {/* Without a linked record, the message's own page explains it. */}
                    <Link href={`/notifications/${n.id}`} onClick={read} className="hover:underline">
                      {n.title}
                    </Link>
                    {group.ids.length > 1 ? (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        ×{group.ids.length}
                      </span>
                    ) : null}
                    {isUnread ? <span className="sr-only"> (unread)</span> : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{n.body}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {/* Opening the record is the main move; marking read is secondary. */}
                  {target ? (
                    <Link href={target.href} onClick={read} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      {target.label}
                    </Link>
                  ) : null}
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {formatRelative(n.createdAt)}
                    {isUnread ? (
                      <button type="button" onClick={() => void markRead(group)} className="font-medium text-primary hover:underline">
                        Mark read
                      </button>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
