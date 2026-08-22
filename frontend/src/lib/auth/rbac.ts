import {
  AUTHENTICATED_ROLES,
  BILLING_READ_ROLES,
  DASHBOARD_ANALYTICS_ROLES,
  DASHBOARD_READ_ROLES,
  DASHBOARD_REPORT_ROLES,
  INCIDENT_REPORT_ROLES,
  ISOLATION_READ_ROLES,
  LOTOTO_WRITE_ROLES,
  MDP_READ_ROLES,
  NAV_ACTIVE_WORK_ROLES,
  NAV_APPROVALS_ROLES,
  NAV_CLOSURE_ROLES,
  NAV_DEFERRED_ROLES,
  NAV_DRAFTS_ROLES,
  NAV_EXECUTION_ROLES,
  NAV_INCIDENTS_ROLES,
  NAV_LOTOTO_ROLES,
  NAV_OPERATOR_DRAFTS_ROLES,
  NAV_ORGANISATION_ROLES,
  NAV_PERMITS_ROLES,
  NAV_SIMOPS_ROLES,
  NAV_WORKFORCE_ROLES,
  NOTIFICATION_READ_ROLES,
  ORGANISATION_READ_ROLES,
  PERMIT_CREATE_ROLES,
  PERMIT_WRITE_ROLES,
  RESTORATION_READ_ROLES,
  WORKFORCE_WRITE_ROLES,
} from "@/lib/auth/roles";

type RouteRule = {
  test: (pathname: string) => boolean;
  roles: readonly string[];
};

const ORGANISATION_ADMIN_PATHS = ["/organisation/profile", "/organisation/workflows", "/organisation/notifications"];

const ROUTE_RULES: RouteRule[] = [
  { test: (p) => p === "/unauthorized" || p === "/settings", roles: AUTHENTICATED_ROLES },
  { test: (p) => p === "/billing", roles: BILLING_READ_ROLES },
  { test: (p) => p === "/analytics", roles: DASHBOARD_ANALYTICS_ROLES },
  { test: (p) => p === "/reports", roles: DASHBOARD_REPORT_ROLES },
  { test: (p) => p === "/workforce/roles", roles: WORKFORCE_WRITE_ROLES },
  { test: (p) => p.startsWith("/workforce"), roles: NAV_WORKFORCE_ROLES },
  {
    test: (p) => ORGANISATION_ADMIN_PATHS.some((prefix) => p === prefix || p.startsWith(`${prefix}/`)),
    roles: ORGANISATION_READ_ROLES,
  },
  { test: (p) => p.startsWith("/organisation"), roles: NAV_ORGANISATION_ROLES },
  { test: (p) => p === "/permits/new", roles: PERMIT_CREATE_ROLES },
  {
    test: (p) => /\/permits\/[^/]+\/edit$/.test(p),
    roles: [...NAV_DRAFTS_ROLES, ...NAV_OPERATOR_DRAFTS_ROLES],
  },
  { test: (p) => /\/permits\/[^/]+\/execute$/.test(p), roles: NAV_EXECUTION_ROLES },
  { test: (p) => /\/permits\/[^/]+\/multi-day$/.test(p), roles: MDP_READ_ROLES },
  {
    test: (p) => p === "/permits/drafts" || p.startsWith("/permits/drafts/"),
    roles: [...NAV_DRAFTS_ROLES, ...NAV_OPERATOR_DRAFTS_ROLES],
  },
  { test: (p) => p.startsWith("/permits"), roles: NAV_PERMITS_ROLES },
  { test: (p) => p === "/active-permits", roles: NAV_ACTIVE_WORK_ROLES },
  {
    test: (p) => p === "/approvals/deferred" || p.startsWith("/approvals/deferred/"),
    roles: NAV_DEFERRED_ROLES,
  },
  { test: (p) => p.startsWith("/approvals"), roles: NAV_APPROVALS_ROLES },
  { test: (p) => p.startsWith("/execution"), roles: NAV_EXECUTION_ROLES },
  { test: (p) => p === "/lototo/plans/new", roles: LOTOTO_WRITE_ROLES },
  { test: (p) => p.startsWith("/lototo/execute"), roles: ISOLATION_READ_ROLES },
  { test: (p) => p.startsWith("/lototo/restoration"), roles: RESTORATION_READ_ROLES },
  { test: (p) => p.startsWith("/lototo"), roles: NAV_LOTOTO_ROLES },
  { test: (p) => p === "/incidents/new", roles: INCIDENT_REPORT_ROLES },
  { test: (p) => p.startsWith("/incidents"), roles: NAV_INCIDENTS_ROLES },
  { test: (p) => p.startsWith("/simops"), roles: NAV_SIMOPS_ROLES },
  { test: (p) => p.startsWith("/notifications"), roles: NOTIFICATION_READ_ROLES },
  { test: (p) => p.startsWith("/closure"), roles: NAV_CLOSURE_ROLES },
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
