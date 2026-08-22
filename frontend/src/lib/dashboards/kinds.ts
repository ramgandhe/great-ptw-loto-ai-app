import { hasAnyRole } from "@/lib/auth/rbac";
import type { DashboardKind } from "@/lib/dashboards/types";

const KIND_PRIORITY: DashboardKind[] = ["management", "safety", "hod", "personal"];

const KIND_ROLE_ACCESS: Record<DashboardKind, readonly string[]> = {
  management: ["org-admin", "platform-admin"],
  safety: ["safety-officer", "org-admin", "platform-admin"],
  hod: ["hod", "safety-officer", "org-admin", "platform-admin"],
  personal: [
    "operator",
    "job-issuer",
    "viewer",
    "hod",
    "safety-officer",
    "org-admin",
    "platform-admin",
  ],
};

/** Highest-priority dashboard kind for the user's PRD persona. */
export function resolveDashboardKind(userRoles: string[]): DashboardKind {
  for (const kind of KIND_PRIORITY) {
    if (hasAnyRole(userRoles, KIND_ROLE_ACCESS[kind])) {
      return kind;
    }
  }
  return "personal";
}

/** Kinds the user may view — one per persona unless they hold multiple leadership roles. */
export function getAllowedDashboardKinds(userRoles: string[]): DashboardKind[] {
  const primary = resolveDashboardKind(userRoles);
  return [primary];
}
