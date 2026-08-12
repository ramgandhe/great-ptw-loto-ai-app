import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
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
  Shield,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  APPROVAL_READ_ROLES,
  AUTHENTICATED_ROLES,
  CLOSURE_READ_ROLES,
  DASHBOARD_ANALYTICS_ROLES,
  DASHBOARD_READ_ROLES,
  DASHBOARD_REPORT_ROLES,
  EXECUTION_READ_ROLES,
  INCIDENT_READ_ROLES,
  LOTOTO_READ_ROLES,
  MASTER_DATA_READ_ROLES,
  NOTIFICATION_READ_ROLES,
  PERMIT_READ_ROLES,
  SAFETY_HUB_ROLES,
  SIMOPS_READ_ROLES,
  WORKFORCE_READ_ROLES,
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
  { href: "/reports", label: "Reports", icon: FileText, roles: DASHBOARD_REPORT_ROLES },
  { href: "/organisation", label: "Organisation", icon: Building2, roles: MASTER_DATA_READ_ROLES },
  { href: "/permits", label: "Permits", icon: ClipboardList, roles: PERMIT_READ_ROLES },
  { href: "/active-permits", label: "Active work", icon: Activity, roles: EXECUTION_READ_ROLES },
  { href: "/permits/drafts", label: "Drafts", icon: FileEdit, roles: PERMIT_READ_ROLES },
  { href: "/approvals", label: "Approvals", icon: CheckSquare, roles: APPROVAL_READ_ROLES },
  { href: "/approvals/deferred", label: "Deferred", icon: ListChecks, roles: APPROVAL_READ_ROLES },
  { href: "/execution", label: "Execution", icon: Hammer, roles: EXECUTION_READ_ROLES },
  { href: "/lototo", label: "LOTOTO", icon: LockKeyhole, roles: LOTOTO_READ_ROLES },
  { href: "/simops", label: "SIMOPS", icon: TriangleAlert, roles: SIMOPS_READ_ROLES },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle, roles: INCIDENT_READ_ROLES },
  { href: "/notifications", label: "Notifications", icon: Bell, roles: NOTIFICATION_READ_ROLES },
  { href: "/closure", label: "Closure", icon: Lock, roles: CLOSURE_READ_ROLES },
  { href: "/settings", label: "Settings", icon: Settings, roles: AUTHENTICATED_ROLES },
  { href: "/workforce", label: "Workforce", icon: Users, roles: WORKFORCE_READ_ROLES },
  { href: "/safety", label: "Safety", icon: Shield, roles: SAFETY_HUB_ROLES },
];

export function getNavItemsForRoles(userRoles: string[]): AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => hasAnyRole(userRoles, item.roles));
}
