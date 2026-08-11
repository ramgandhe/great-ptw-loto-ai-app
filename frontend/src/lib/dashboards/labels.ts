import type { AnalyticsScope, DashboardKind } from "./types";

export const DASHBOARD_KIND_LABELS: Record<DashboardKind, string> = {
  personal: "Personal",
  supervisor: "Supervisor",
  safety: "Safety",
  management: "Management",
};

export const KPI_LABELS: Record<string, { label: string; href?: string }> = {
  active_permits: { label: "Active permits", href: "/execution" },
  pending_approvals: { label: "Pending approvals", href: "/approvals" },
  suspended_permits: { label: "Suspended permits", href: "/execution" },
  open_incidents: { label: "Open incidents", href: "/incidents" },
  closed_incidents: { label: "Closed incidents", href: "/incidents/archive" },
  open_simops_conflicts: { label: "Open SIMOPS conflicts", href: "/simops" },
  active_lototo_executions: { label: "Active LOTOTO executions", href: "/lototo" },
};

export const ANALYTICS_SCOPE_LABELS: Record<AnalyticsScope, string> = {
  operational: "Operational",
  permits: "Permits",
  incidents: "Incidents",
  lototo: "LOTOTO",
  simops: "SIMOPS",
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  permit_summary: "Permit summary",
  incident_summary: "Incident summary",
  simops_summary: "SIMOPS summary",
  lototo_summary: "LOTOTO summary",
  operational_kpis: "Operational KPIs",
};
