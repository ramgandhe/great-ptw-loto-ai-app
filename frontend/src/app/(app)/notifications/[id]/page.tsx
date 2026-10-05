"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getNotification, markNotificationRead } from "@/lib/notifications/api";
import { notificationTarget } from "@/lib/notifications/routes";
import type { Notification } from "@/lib/notifications/types";
import { NotificationPriorityLabel } from "@/components/notifications/notification-priority-label";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

const CATEGORY_LABELS: Record<Notification["category"], string> = {
  workflow: "Workflow",
  reminder: "Reminder",
  escalation: "Escalation",
  system: "System",
};

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!params.id) {
      return;
    }

    setIsLoading(true);
    setError(null);

    // Opening a notification reads it.
    getNotification(params.id)
      .then((n) => (n.readAt === null ? markNotificationRead(n.id) : n))
      .then(setNotification)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load notification");
      })
      .finally(() => setIsLoading(false));
  }, [params.id]);

  const target = notification ? notificationTarget(notification) : null;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => router.push("/notifications")}>
          Back to centre
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading notification…</p>
      ) : error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : notification ? (
        <article className="max-w-2xl space-y-4 rounded-lg border border-border p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-3xl font-bold tracking-tight">{notification.title}</h1>
            {notification.readAt === null ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                Unread
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Read {formatDateTime(notification.readAt)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <NotificationPriorityLabel priority={notification.priority} />
            <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium">
              {CATEGORY_LABELS[notification.category]}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-foreground">{notification.body}</p>

          <dl className="grid gap-2 text-sm text-muted-foreground">
            <div>
              <dt className="font-medium text-foreground">Received</dt>
              <dd>{formatDateTime(notification.createdAt)}</dd>
            </div>
            {notification.deliveredAt ? (
              <div>
                <dt className="font-medium text-foreground">Delivered</dt>
                <dd>{formatDateTime(notification.deliveredAt)}</dd>
              </div>
            ) : null}
            {notification.eventType ? (
              <div>
                <dt className="font-medium text-foreground">Event</dt>
                <dd>{notification.eventType.replace(/_/g, " ")}</dd>
              </div>
            ) : null}
          </dl>

          {target ? (
            <Link href={target.href} className={buttonVariants({ size: "lg" })}>
              {target.label}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">This message is not linked to a record.</p>
          )}
        </article>
      ) : null}
    </main>
  );
}
