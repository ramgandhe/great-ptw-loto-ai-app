import type { Notification } from "./types";
import { workspaceHref } from "@/lib/permit/workspace-tabs";

export function getNotificationEntityHref(notification: Notification): string | null {
  if (!notification.entityType || !notification.entityId) {
    return null;
  }

  switch (notification.entityType) {
    case "permit":
      return `/permits/${notification.entityId}`;
    case "incident":
      return `/incidents/${notification.entityId}`;
    case "approval":
      return workspaceHref(notification.entityId, "review");
    case "execution":
      return workspaceHref(notification.entityId, "work");
    case "lototo_plan":
      return `/lototo/${notification.entityId}`;
    case "simops_conflict":
      return `/simops/${notification.entityId}`;
    case "closure":
      return workspaceHref(notification.entityId, "review");
    default:
      return null;
  }
}
