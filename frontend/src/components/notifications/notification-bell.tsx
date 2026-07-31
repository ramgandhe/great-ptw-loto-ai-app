"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listNotifications } from "@/lib/notifications/api";
import { NotificationBadge } from "@/components/notifications/notification-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    listNotifications({ unreadOnly: true })
      .then((items) => setUnreadCount(items.length))
      .catch((err) => {
        if (err instanceof ApiError && err.code === "NotFound") {
          setUnreadCount(0);
        }
      });
  }, []);

  return (
    <Link href="/notifications" aria-label="Open notification centre" className="relative">
      <Button type="button" variant="outline" size="sm" className="relative">
        <Icon icon={Bell} size="sm" />
        <span className="sr-only">Notifications</span>
        <NotificationBadge count={unreadCount} />
      </Button>
    </Link>
  );
}
