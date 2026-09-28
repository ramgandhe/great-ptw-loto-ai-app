import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  Building2,
  FileText,
  LayoutDashboard,
  Route,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  BILLING_READ_ROLES,
  DASHBOARD_ANALYTICS_ROLES,
  DASHBOARD_READ_ROLES,
  DASHBOARD_REPORT_ROLES,
  NAV_INCIDENTS_ROLES,
  NAV_LOTOTO_ROLES,
  NAV_ORGANISATION_ROLES,
  NAV_PERMITS_ROLES,
  NAV_SIMOPS_ROLES,
  NAV_WORKFORCE_ROLES,
  PLATFORM_ADMIN_ROLES,
} from "@/lib/auth/roles";
import { DOMAIN_ICONS } from "@/lib/domain-icons";
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
  { href: "/permits", label: "Permits", icon: DOMAIN_ICONS.permit, roles: NAV_PERMITS_ROLES, group: "Work" },
  { href: "/lototo", label: "LOTOTO", icon: DOMAIN_ICONS.lototo, roles: NAV_LOTOTO_ROLES, group: "Safety" },
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
  return APP_NAV_ITEMS.filter((item) => hasAnyRole(userRoles, item.roles));
}
