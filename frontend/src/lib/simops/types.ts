export type ConflictStatus =
  | "open"
  | "assessed"
  | "mitigation_planned"
  | "approved"
  | "rejected";
export type ConflictSeverity = "low" | "medium" | "high";
export type ConflictType =
  | "location"
  | "equipment"
  | "schedule"
  | "permit_type"
  | "adjacency"
  | "hazard"
  | "energy_source";

export type SimopsConflict = {
  id: string;
  tenantId: string;
  status: ConflictStatus;
  severity: ConflictSeverity;
  conflictType: ConflictType;
  summary: string;
  details?: Record<string, unknown> | null;
  detectedAt: string;
  fingerprint: string;
  frozenPermitId?: string | null;
  requiresJointAck?: boolean;
  ackUserA?: string | null;
  ackUserB?: string | null;
  escalateAfter?: string | null;
  escalatedAt?: string | null;
  escalatedToRole?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConflictParticipant = {
  id: string;
  conflictId: string;
  permitId: string;
  permit: {
    id: string;
    reference: string | null;
    title: string;
    status: string;
    plannedStartAt: string | null;
    plannedEndAt: string | null;
  };
};

export type ConflictAlert = {
  id: string;
  conflictId: string;
  severity: ConflictSeverity;
  message: string;
  channel: string;
  recipientRole: string;
  status: string;
  acknowledgedAt: string | null;
  createdAt: string;
};

export type ConflictAssessment = {
  id: string;
  conflictId: string;
  assessedSeverity: ConflictSeverity;
  riskSummary: string;
  assessedBy: string;
  assessedAt: string;
};

export type MitigationAction = {
  description: string;
  assigneeUserId?: string;
  dueAt?: string;
};

export type MitigationPlan = {
  id: string;
  conflictId: string;
  assessmentId: string;
  planSummary: string;
  actions: MitigationAction[];
};

export type ConflictResolution = {
  id: string;
  conflictId: string;
  outcome: "approved" | "rejected";
  comments: string;
  resolvedBy: string;
  resolvedAt: string;
};

export type ConflictHistoryEntry = {
  id: string;
  conflictId: string;
  action: string;
  actorUserId: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type ConflictDetail = {
  conflict: SimopsConflict;
  participants: ConflictParticipant[];
  alerts: ConflictAlert[];
  assessment: ConflictAssessment | null;
  mitigation: MitigationPlan | null;
  resolution: ConflictResolution | null;
  history: ConflictHistoryEntry[];
};

export type AnalyseResult = {
  analysedPermitCount: number;
  detectedCount: number;
  createdCount: number;
  skippedCount: number;
};

export type AlertListItem = {
  alert: ConflictAlert;
  conflict: SimopsConflict;
};

export type HistoryListItem = {
  conflict: SimopsConflict;
  resolution: ConflictResolution;
};

export type AssessConflictPayload = {
  assessedSeverity: ConflictSeverity;
  riskSummary: string;
};

export type MitigationPlanPayload = {
  planSummary: string;
  actions: MitigationAction[];
};

export type ApproveConflictPayload = {
  comments: string;
};

export type RejectConflictPayload = {
  reason: string;
};
