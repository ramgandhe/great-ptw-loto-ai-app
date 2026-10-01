import type { Notification } from "./types";
import { workspaceHref } from "@/lib/permit/workspace-tabs";

/** The record a message is about and the button that opens it; null when it has no linked record. */
export function notificationTarget(notification: Notification): { href: string; label: string } | null {
  const id = notification.entityId;
  if (!notification.entityType || !id) return null;
  switch (notification.entityType) {
    case "permit":
      return { href: workspaceHref(id), label: "Open permit" };
    case "approval":
      return { href: workspaceHref(id, "review"), label: "Open review" };
    case "execution":
      return { href: workspaceHref(id, "work"), label: "Open work" };
    case "closure":
      return { href: workspaceHref(id, "review"), label: "Open closure" };
    case "incident":
      return { href: `/incidents/${id}`, label: "Open incident" };
    case "lototo_plan":
      return { href: `/lototo/plans/${id}`, label: "Open LOTOTO plan" };
    case "simops_conflict":
    case "conflict":
      return { href: `/simops/conflicts/${id}`, label: "Open clash" };
    case "tenant_subscription":
      return { href: "/billing", label: "Open billing" };
    default:
      return null;
  }
}
