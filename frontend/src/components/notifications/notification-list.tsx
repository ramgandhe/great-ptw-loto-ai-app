"use client";

import Link from "next/link";
import type { Notification } from "@/lib/notifications/types";
import { NotificationPriorityLabel } from "@/components/notifications/notification-priority-label";
import { cn } from "@/lib/utils";

interface NotificationListProps {
  items: Notification[];
  onMarkRead?: (id: string) => void;
  markingReadId?: string | null;
}

const CATEGORY_LABELS: Record<Notification["category"], string> = {
  workflow: "Workflow",
  reminder: "Reminder",
  escalation: "Escalation",
  system: "System",
};

export function NotificationList({ items, onMarkRead, markingReadId }: NotificationListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No notifications match your filters.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {items.map((notification) => {
        const isUnread = notification.readAt === null;

        return (
          <li key={notification.id}>
            <div
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 px-4 py-3",
                isUnread && "bg-accent/20",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/notifications/${notification.id}`}
                    className="font-medium hover:underline"
                  >
                    {notification.title}
                  </Link>
                  {isUnread ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                      Unread
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{notification.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[notification.category]} ·{" "}
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <NotificationPriorityLabel priority={notification.priority} />
                {isUnread && onMarkRead ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                    disabled={markingReadId === notification.id}
                    onClick={() => onMarkRead(notification.id)}
                  >
                    {markingReadId === notification.id ? "Marking…" : "Mark read"}
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
