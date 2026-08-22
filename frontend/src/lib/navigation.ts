import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
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
  Settings,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  AUTHENTICATED_ROLES,
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
} from "@/lib/auth/roles";
import { hasAnyRole } from "@/lib/auth/rbac";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly string[];
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: DASHBOARD_READ_ROLES },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: DASHBOARD_ANALYTICS_ROLES },
  { href: "/organisation", label: "Organisation", icon: Building2, roles: NAV_ORGANISATION_ROLES },
  { href: "/permits", label: "Permits", icon: ClipboardList, roles: NAV_PERMITS_ROLES },
  { href: "/active-permits", label: "Active work", icon: Activity, roles: NAV_ACTIVE_WORK_ROLES },
  { href: "/permits/drafts", label: "Drafts", icon: FileEdit, roles: NAV_DRAFTS_ROLES },
  {
    href: "/permits/drafts",
    label: "Assigned drafts",
    icon: FileEdit,
    roles: NAV_OPERATOR_DRAFTS_ROLES,
  },
  { href: "/approvals", label: "Approvals", icon: CheckSquare, roles: NAV_APPROVALS_ROLES },
  { href: "/approvals/deferred", label: "Deferred", icon: ListChecks, roles: NAV_DEFERRED_ROLES },
  { href: "/execution", label: "Execution", icon: Hammer, roles: NAV_EXECUTION_ROLES },
  { href: "/lototo", label: "LOTOTO", icon: LockKeyhole, roles: NAV_LOTOTO_ROLES },
  { href: "/simops", label: "SIMOPS", icon: TriangleAlert, roles: NAV_SIMOPS_ROLES },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle, roles: NAV_INCIDENTS_ROLES },
  { href: "/closure", label: "Closure", icon: Lock, roles: NAV_CLOSURE_ROLES },
  { href: "/reports", label: "Reports", icon: FileText, roles: DASHBOARD_REPORT_ROLES },
  { href: "/settings", label: "Settings", icon: Settings, roles: AUTHENTICATED_ROLES },
  { href: "/workforce", label: "Workforce", icon: Users, roles: NAV_WORKFORCE_ROLES },
];

export function getNavItemsForRoles(userRoles: string[]): AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => hasAnyRole(userRoles, item.roles));
}
