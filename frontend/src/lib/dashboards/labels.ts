import type { AnalyticsScope, DashboardKind } from "./types";

export const DASHBOARD_KIND_LABELS: Record<DashboardKind, string> = {
  personal: "Personal",
  hod: "Head of Department",
  safety: "Safety",
  management: "Management",
};

export const KPI_LABELS: Record<string, { label: string; href?: string }> = {
  active_permits: { label: "Active permits", href: "/execution" },
  pending_approvals: { label: "Pending approvals", href: "/approvals" },
  suspended_permits: { label: "Suspended permits", href: "/execution" },
  open_incidents: { label: "Open incidents", href: "/incidents" },
  closed_incidents: { label: "Closed incidents", href: "/incidents/archive" },
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
  operational_kpis: "Operational KPIs",
};
