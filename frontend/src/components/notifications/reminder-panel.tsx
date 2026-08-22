"use client";

import Link from "next/link";
import type { Notification } from "@/lib/notifications/types";
import { NotificationPriorityLabel } from "@/components/notifications/notification-priority-label";

interface ReminderPanelProps {
  reminders: Notification[];
}

export function ReminderPanel({ reminders }: ReminderPanelProps) {
  if (reminders.length === 0) {
    return (
      <section className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Reminders</h2>
        <p className="mt-2 text-sm text-muted-foreground">No pending reminders.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">Reminders</h2>
      <ul className="mt-3 space-y-3">
        {reminders.map((reminder) => (
          <li key={reminder.id} className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link href={`/notifications/${reminder.id}`} className="text-sm font-medium hover:underline">
                {reminder.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                Due {new Date(reminder.createdAt).toLocaleString()}
              </p>
            </div>
            <NotificationPriorityLabel priority={reminder.priority} />
          </li>
        ))}
      </ul>
    </section>
  );
}
