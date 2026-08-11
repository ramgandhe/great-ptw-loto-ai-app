export type DashboardKind = "personal" | "supervisor" | "safety" | "management";

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
  openSimopsConflicts?: number;
  activeLototoExecutions?: number;
  myOpenPermits?: number;
  requirementId?: string;
}

export interface DashboardPayload {
  kind: DashboardKind;
  summary: DashboardSummary;
  kpis: KpiBundle;
  refreshedAt: string;
}
