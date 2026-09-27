export type CountRow = { key: string; label?: string; color?: string | null; count: number };

export type InsightsPayload = {
  period: { days: number; from: string; to: string };
  attention: {
    overdueActivePermits: number;
    approvalsWaitingOverDay: number;
    highSeverityConflicts: number;
    criticalIncidentsOpen: number;
    overdueCorrectiveActions: number;
    suspendedPermits: number;
  };
  permits: {
    byStatus: CountRow[];
    byType: CountRow[];
    byDepartment: CountRow[];
    hotspots: CountRow[];
    timeline: { day: string; raised: number; closed: number }[];
  };
  approvals: {
    decisions: Record<string, number>;
    decided: number;
    medianHoursToDecision: number | null;
    waitingByAge: CountRow[];
  };
  incidents: {
    total: number;
    open: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    timeline: { day: string; reported: number }[];
  };
  simops: { open: number; bySeverity: { key: string; open: number; resolved: number }[] };
  actions: { open: number; overdue: number; completed: number };
};

export type ReportViewType = "permit_summary" | "incident_summary";

export type PermitReportRow = {
  id: string;
  reference: string | null;
  title: string;
  status: string;
  type: string | null;
  typeColor: string | null;
  department: string | null;
  place: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  createdAt: string;
};

export type IncidentReportRow = {
  id: string;
  reference: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  occurredAt: string;
  place: string | null;
};

export type ReportView<T> = { type: ReportViewType; period: { days: number; from: string; to: string }; rows: T[] };
