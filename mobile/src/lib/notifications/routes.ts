import type { Notification } from "./types";

export function getNotificationEntityRoute(notification: Notification): string | null {
  if (!notification.entityType || !notification.entityId) {
    return null;
  }

  switch (notification.entityType) {
    case "permit":
      return `/permits/${notification.entityId}`;
    case "incident":
      return `/incidents/${notification.entityId}`;
    case "approval":
      return `/approvals/${notification.entityId}`;
    case "execution":
      return `/execution/${notification.entityId}`;
    case "lototo_plan":
      return `/lototo/${notification.entityId}`;
    case "simops_conflict":
      return `/simops/${notification.entityId}`;
    case "closure":
      return `/closure/${notification.entityId}`;
    default:
      return null;
  }
}
