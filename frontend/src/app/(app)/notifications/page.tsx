"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { listNotifications, markNotificationRead } from "@/lib/notifications/api";
import type { Notification } from "@/lib/notifications/types";
import {
  NotificationFilters,
  type NotificationFiltersState,
  type ReadFilter,
} from "@/components/notifications/notification-filters";
import { NotificationList } from "@/components/notifications/notification-list";
import { ReminderPanel } from "@/components/notifications/reminder-panel";

function parseReadFilter(value: string | null): ReadFilter {
  if (value === "unread" || value === "read") {
    return value;
  }
  return "all";
}

function parseCategory(value: string | null): NotificationFiltersState["category"] {
  if (
    value === "workflow" ||
    value === "reminder" ||
    value === "escalation" ||
    value === "system"
  ) {
    return value;
  }
  return "all";
}

function applyFilters(items: Notification[], filters: NotificationFiltersState): Notification[] {
  return items.filter((item) => {
    if (filters.readFilter === "read" && item.readAt === null) {
      return false;
    }
    if (filters.readFilter === "unread" && item.readAt !== null) {
      return false;
    }
    if (filters.priority !== "all" && item.priority !== filters.priority) {
      return false;
    }
    if (filters.category !== "all" && item.category !== filters.category) {
      return false;
    }
    return true;
  });
}

export default function NotificationsPage() {
  const searchParams = useSearchParams();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [filters, setFilters] = useState<NotificationFiltersState>(() => ({
    readFilter: parseReadFilter(searchParams.get("read")),
    priority: "all",
    category: parseCategory(searchParams.get("category")),
  }));

  const loadNotifications = useCallback(() => {
    setIsLoading(true);
    setError(null);

    listNotifications({
      unreadOnly: filters.readFilter === "unread" ? true : undefined,
    })
      .then(setNotifications)
      .catch((err) => {
        setNotifications([]);
        setError(err instanceof ApiError ? err.message : "Failed to load notifications");
      })
      .finally(() => setIsLoading(false));
  }, [filters.readFilter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filteredNotifications = useMemo(
    () => applyFilters(notifications, filters),
    [notifications, filters],
  );

  const reminders = useMemo(
    () =>
      notifications.filter(
        (item) => item.category === "reminder" && item.readAt === null,
      ),
    [notifications],
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.readAt === null).length,
    [notifications],
  );

  async function handleMarkRead(id: string) {
    setMarkingReadId(id);
    try {
      const updated = await markNotificationRead(id);
      setNotifications((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark notification as read");
    } finally {
      setMarkingReadId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Notification centre</h1>
        <p className="text-sm text-muted-foreground">
          Review operational alerts, task assignments, reminders and escalations.
        </p>
        {!isLoading && !error ? (
          <p className="mt-1 text-xs text-muted-foreground">{unreadCount} unread</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-4">
          <NotificationFilters value={filters} onChange={setFilters} />

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading notifications…</p>
          ) : (
            <NotificationList
              items={filteredNotifications}
              onMarkRead={handleMarkRead}
              markingReadId={markingReadId}
            />
          )}
        </div>

        <aside>
          <ReminderPanel reminders={reminders.slice(0, 5)} />
        </aside>
      </div>
    </main>
  );
}
