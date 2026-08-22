"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { listNotifications, markNotificationRead } from "@/lib/notifications/api";
import type { Notification } from "@/lib/notifications/types";
import { NotificationList } from "@/components/notifications/notification-list";
import { ReminderPanel } from "@/components/notifications/reminder-panel";
import { Button } from "@/components/ui/button";

const DASHBOARD_NOTIFICATION_LIMIT = 8;

export function DashboardNotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadNotifications = useCallback(() => {
    setIsLoading(true);
    setError(null);

    listNotifications()
      .then(setNotifications)
      .catch((err) => {
        setNotifications([]);
        setError(err instanceof ApiError ? err.message : "Failed to load notifications");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.readAt === null).length,
    [notifications],
  );

  const reminders = useMemo(
    () => notifications.filter((item) => item.category === "reminder" && item.readAt === null),
    [notifications],
  );

  const visibleNotifications = useMemo(() => {
    const sorted = [...notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return showAll ? sorted : sorted.slice(0, DASHBOARD_NOTIFICATION_LIMIT);
  }, [notifications, showAll]);

  async function handleMarkRead(id: string) {
    setMarkingReadId(id);
    try {
      const updated = await markNotificationRead(id);
      setNotifications((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark notification as read");
    } finally {
      setMarkingReadId(null);
    }
  }

  return (
    <section aria-label="Notifications" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Notifications</h2>
          {!isLoading && !error ? (
            <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={loadNotifications} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading notifications…</p>
          ) : (
            <>
              <NotificationList
                items={visibleNotifications}
                onMarkRead={handleMarkRead}
                markingReadId={markingReadId}
              />
              {notifications.length > DASHBOARD_NOTIFICATION_LIMIT ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowAll((current) => !current)}
                >
                  {showAll ? "Show fewer" : `Show all (${notifications.length})`}
                </Button>
              ) : null}
            </>
          )}
        </div>
        <ReminderPanel reminders={reminders.slice(0, 5)} />
      </div>
    </section>
  );
}
