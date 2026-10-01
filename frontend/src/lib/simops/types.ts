export type ConflictStatus =
  | "open"
  | "assessed"
  | "mitigation_planned"
  | "approved"
  | "rejected";
export type ConflictSeverity = "low" | "medium" | "high";
export type ConflictType = "location" | "equipment" | "schedule" | "permit_type";

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

export type SimopsPermitDecision = "allow" | "allow_with_controls" | "reject";

export type SimopsCasePermit = {
  id: string;
  permitId: string;
  decision: SimopsPermitDecision | null;
  comments: string | null;
  permit: {
    id: string;
    reference: string | null;
    title: string;
    status: string;
    plannedStartAt: string | null;
    plannedEndAt: string | null;
  };
  hazards: Array<{ hazardCatalogueId: string; extraConsequences?: unknown; extraControls?: unknown }>;
  ppe: Array<{ ppeCatalogueId: string }>;
  lototo: Array<{ procedureId?: string | null }>;
};

export type SimopsCaseInteraction = {
  id: string;
  permitIdA: string;
  permitIdB: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  summary: string;
};

export type SimopsCaseControl = {
  id: string;
  permitId: string;
  controlText: string;
  responsibleUserId: string;
  comments: string | null;
};

export type SimopsCasePerson = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type SimopsCaseDetail = {
  case: {
    id: string;
    status: "review_required" | "resolved";
    severity: ConflictSeverity;
    summary: string;
    detectedAt: string;
    resolvedAt: string | null;
  };
  members: SimopsCasePermit[];
  interactions: SimopsCaseInteraction[];
  controls: SimopsCaseControl[];
  people: SimopsCasePerson[];
};

export type ResolveSimopsCasePayload = {
  decisions: Array<{ permitId: string; decision: SimopsPermitDecision; comments?: string }>;
  controls?: Array<{
    permitId: string;
    controlText: string;
    responsibleUserId: string;
    comments?: string;
  }>;
};
