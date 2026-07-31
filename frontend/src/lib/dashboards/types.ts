export type DashboardKind = "personal" | "supervisor" | "safety" | "management";

export type AnalyticsScope = "permits" | "incidents" | "lototo" | "simops" | "operational";

export type ReportType = "permit_summary" | "incident_summary" | "operational_kpis";

export type ReportFormat = "pdf" | "xlsx" | "csv";

export type ReportStatus = "pending" | "generating" | "ready" | "failed" | "expired";

export interface KpiItem {
  key: string;
  value: Record<string, unknown>;
}

export interface KpiBundle {
  kind: DashboardKind;
  periodLabel: string;
  items: KpiItem[];
  computedAt: string;
}

export interface DashboardSummary {
  activePermits?: number;
  pendingApprovals?: number;
  openIncidents?: number;
  myOpenPermits?: number;
}

export interface DashboardPayload {
  kind: DashboardKind;
  preferences: {
    dashboardKind: DashboardKind;
    refreshSeconds: number;
  };
  summary: DashboardSummary;
  kpis: KpiBundle;
  refreshedAt: string;
}

export interface AnalyticsSnapshot {
  id: string;
  scope: AnalyticsScope;
  payload: Record<string, unknown>;
  capturedAt: string;
}

export interface AnalyticsPayload {
  scope: AnalyticsScope;
  source: "snapshot" | "live";
  snapshot: AnalyticsSnapshot | null;
  payload?: Record<string, unknown>;
  capturedAt: string;
}

export interface AnalyticsTrendsPayload {
  scope: AnalyticsScope;
  points: AnalyticsSnapshot[];
}

export interface ReportExport {
  id: string;
  reportType: string;
  format: ReportFormat;
  status: ReportStatus;
  fileName: string | null;
  storageKey: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface GenerateReportPayload {
  reportType: ReportType;
  format: ReportFormat;
  filters?: Record<string, unknown>;
  periodStart?: string;
  periodEnd?: string;
}
