import { hasAnyRole } from "@/lib/auth/rbac";
import type { DashboardKind } from "@/lib/dashboards/types";

const KIND_PRIORITY: DashboardKind[] = ["management", "safety", "hod", "personal"];

const KIND_ROLE_ACCESS: Record<DashboardKind, readonly string[]> = {
  management: ["tenant-owner", "tenant-admin", "platform-admin"],
  safety: ["safety-officer", "tenant-owner", "tenant-admin", "platform-admin"],
  hod: ["hod", "safety-officer", "tenant-owner", "tenant-admin", "platform-admin"],
  personal: [
    "operator",
    "job-issuer",
    "viewer",
    "hod",
    "safety-officer",
    "tenant-owner", "tenant-admin",
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

/** Kinds the user may view. Admins can switch between all kinds for full visibility. */
export function getAllowedDashboardKinds(userRoles: string[]): DashboardKind[] {
  const isAdmin =
    userRoles.includes("tenant-owner") ||
    userRoles.includes("tenant-admin") ||
    userRoles.includes("platform-admin");
  if (isAdmin) {
    return KIND_PRIORITY.filter((kind) => hasAnyRole(userRoles, KIND_ROLE_ACCESS[kind]));
  }
  const primary = resolveDashboardKind(userRoles);
  return [primary];
}
