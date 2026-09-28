import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  AlertTriangle,
  BarChart3,
  CreditCard,
  Building2,
  CheckSquare,
  ClipboardList,
  FileEdit,
  FileText,
  Hammer,
  LayoutDashboard,
  ListChecks,
  Lock,
  LockKeyhole,
  Route,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  BILLING_READ_ROLES,
  DASHBOARD_ANALYTICS_ROLES,
  DASHBOARD_READ_ROLES,
  DASHBOARD_REPORT_ROLES,
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
  PLATFORM_ADMIN_ROLES,
} from "@/lib/auth/roles";
import { hasAnyRole } from "@/lib/auth/rbac";

export type NavGroup = "Work" | "Safety" | "Insights" | "Administration";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly string[];
  group: NavGroup;
};

export const NAV_GROUPS: NavGroup[] = ["Work", "Safety", "Insights", "Administration"];

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, roles: DASHBOARD_READ_ROLES, group: "Work" },
  { href: "/permits", label: "Permits", icon: ClipboardList, roles: NAV_PERMITS_ROLES, group: "Work" },
  { href: "/permits/drafts", label: "Drafts", icon: FileEdit, roles: NAV_DRAFTS_ROLES, group: "Work" },
  { href: "/permits/drafts", label: "Assigned drafts", icon: FileEdit, roles: NAV_OPERATOR_DRAFTS_ROLES, group: "Work" },
  { href: "/approvals", label: "Approvals", icon: CheckSquare, roles: NAV_APPROVALS_ROLES, group: "Work" },
  { href: "/approvals/deferred", label: "Deferred", icon: ListChecks, roles: NAV_DEFERRED_ROLES, group: "Work" },
  { href: "/execution", label: "Active work", icon: Hammer, roles: NAV_EXECUTION_ROLES, group: "Work" },
  { href: "/active-permits", label: "Active work", icon: Activity, roles: NAV_ACTIVE_WORK_ROLES, group: "Work" },
  { href: "/closure", label: "Closure", icon: Lock, roles: NAV_CLOSURE_ROLES, group: "Work" },
  { href: "/notifications", label: "Messages", icon: Bell, roles: NOTIFICATION_READ_ROLES, group: "Work" },
  { href: "/lototo", label: "LOTOTO", icon: LockKeyhole, roles: NAV_LOTOTO_ROLES, group: "Safety" },
  { href: "/simops", label: "SIMOPS", icon: TriangleAlert, roles: NAV_SIMOPS_ROLES, group: "Safety" },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle, roles: NAV_INCIDENTS_ROLES, group: "Safety" },
  { href: "/permits/process", label: "Permit process", icon: Route, roles: NAV_PERMITS_ROLES, group: "Insights" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: DASHBOARD_ANALYTICS_ROLES, group: "Insights" },
  { href: "/reports", label: "Reports", icon: FileText, roles: DASHBOARD_REPORT_ROLES, group: "Insights" },
  { href: "/organisation", label: "Organisation", icon: Building2, roles: NAV_ORGANISATION_ROLES, group: "Administration" },
  { href: "/workforce", label: "Workforce", icon: Users, roles: NAV_WORKFORCE_ROLES, group: "Administration" },
  { href: "/platform/tenants", label: "Tenants", icon: Building2, roles: PLATFORM_ADMIN_ROLES, group: "Administration" },
  { href: "/billing", label: "Billing", icon: CreditCard, roles: BILLING_READ_ROLES, group: "Administration" },
];

export function getNavItemsForRoles(userRoles: string[]): AppNavItem[] {
  const allowed = APP_NAV_ITEMS.filter((item) => hasAnyRole(userRoles, item.roles));
  // /execution already lists active and suspended work; show one "Active work" entry, not two.
  const hasExecution = allowed.some((item) => item.href === "/execution");
  const seen = new Set<string>();
  return allowed.filter((item) => {
    if (hasExecution && item.href === "/active-permits") return false;
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}
