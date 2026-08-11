import {
  AI_ASSISTANT_ROLES,
  APPROVAL_READ_ROLES,
  AUTHENTICATED_ROLES,
  BILLING_READ_ROLES,
  CLOSURE_READ_ROLES,
  DASHBOARD_ANALYTICS_ROLES,
  DASHBOARD_READ_ROLES,
  DASHBOARD_REPORT_ROLES,
  EXECUTION_READ_ROLES,
  INCIDENT_READ_ROLES,
  INCIDENT_REPORT_ROLES,
  ISOLATION_READ_ROLES,
  LOTOTO_READ_ROLES,
  LOTOTO_WRITE_ROLES,
  MASTER_DATA_READ_ROLES,
  MDP_READ_ROLES,
  NOTIFICATION_READ_ROLES,
  ORGANISATION_READ_ROLES,
  ORGANISATION_WRITE_ROLES,
  PERMIT_READ_ROLES,
  PERMIT_WRITE_ROLES,
  PLATFORM_OPS_ROLES,
  RESTORATION_READ_ROLES,
  SAFETY_HUB_ROLES,
  SIMOPS_READ_ROLES,
  WORKFORCE_READ_ROLES,
  WORKFORCE_WRITE_ROLES,
} from "@/lib/auth/roles";

type RouteRule = {
  test: (pathname: string) => boolean;
  roles: readonly string[];
};

const ORGANISATION_ADMIN_PATHS = ["/organisation/profile", "/organisation/workflows", "/organisation/notifications"];

const ROUTE_RULES: RouteRule[] = [
  { test: (p) => p === "/unauthorized" || p === "/settings", roles: AUTHENTICATED_ROLES },
  { test: (p) => p === "/platform", roles: PLATFORM_OPS_ROLES },
  { test: (p) => p === "/billing", roles: BILLING_READ_ROLES },
  { test: (p) => p === "/analytics", roles: DASHBOARD_ANALYTICS_ROLES },
  { test: (p) => p === "/reports", roles: DASHBOARD_REPORT_ROLES },
  { test: (p) => p === "/workforce/roles", roles: WORKFORCE_WRITE_ROLES },
  { test: (p) => p.startsWith("/workforce"), roles: WORKFORCE_READ_ROLES },
  {
    test: (p) => ORGANISATION_ADMIN_PATHS.some((prefix) => p === prefix || p.startsWith(`${prefix}/`)),
    roles: ORGANISATION_READ_ROLES,
  },
  { test: (p) => p.startsWith("/organisation"), roles: MASTER_DATA_READ_ROLES },
  { test: (p) => p === "/permits/new", roles: PERMIT_WRITE_ROLES },
  { test: (p) => /\/permits\/[^/]+\/edit$/.test(p), roles: PERMIT_WRITE_ROLES },
  { test: (p) => /\/permits\/[^/]+\/execute$/.test(p), roles: EXECUTION_READ_ROLES },
  { test: (p) => /\/permits\/[^/]+\/multi-day$/.test(p), roles: MDP_READ_ROLES },
  { test: (p) => p.startsWith("/permits"), roles: PERMIT_READ_ROLES },
  { test: (p) => p === "/active-permits", roles: EXECUTION_READ_ROLES },
  { test: (p) => p.startsWith("/approvals"), roles: APPROVAL_READ_ROLES },
  { test: (p) => p.startsWith("/execution"), roles: EXECUTION_READ_ROLES },
  { test: (p) => p === "/lototo/plans/new", roles: LOTOTO_WRITE_ROLES },
  { test: (p) => p.startsWith("/lototo/execute"), roles: ISOLATION_READ_ROLES },
  { test: (p) => p.startsWith("/lototo/restoration"), roles: RESTORATION_READ_ROLES },
  { test: (p) => p.startsWith("/lototo"), roles: LOTOTO_READ_ROLES },
  { test: (p) => p === "/incidents/new", roles: INCIDENT_REPORT_ROLES },
  { test: (p) => p.startsWith("/incidents"), roles: INCIDENT_READ_ROLES },
  { test: (p) => p.startsWith("/simops"), roles: SIMOPS_READ_ROLES },
  { test: (p) => p.startsWith("/notifications"), roles: NOTIFICATION_READ_ROLES },
  { test: (p) => p.startsWith("/closure"), roles: CLOSURE_READ_ROLES },
  { test: (p) => p === "/ai", roles: AI_ASSISTANT_ROLES },
  { test: (p) => p === "/safety", roles: SAFETY_HUB_ROLES },
  { test: (p) => p === "/", roles: DASHBOARD_READ_ROLES },
];

export function hasAnyRole(userRoles: string[], allowedRoles: readonly string[]): boolean {
  return userRoles.some((role) => allowedRoles.includes(role));
}

export function canAccessPath(pathname: string, userRoles: string[]): boolean {
  if (userRoles.length === 0) {
    return false;
  }

  const rule = ROUTE_RULES.find((entry) => entry.test(pathname));
  if (!rule) {
    return false;
  }

  return hasAnyRole(userRoles, rule.roles);
}

export function getRequiredRolesForPath(pathname: string): readonly string[] | null {
  return ROUTE_RULES.find((entry) => entry.test(pathname))?.roles ?? null;
}

/** First navigable route for this user (fallback when dashboard is denied). */
export function getDefaultHomePath(userRoles: string[]): string {
  const candidates = [
    "/",
    "/permits",
    "/approvals",
    "/execution",
    "/incidents",
    "/notifications",
    "/settings",
  ];

  for (const path of candidates) {
    if (canAccessPath(path, userRoles)) {
      return path;
    }
  }

  return "/settings";
}

export function formatRoleLabel(role: string): string {
  return role
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
