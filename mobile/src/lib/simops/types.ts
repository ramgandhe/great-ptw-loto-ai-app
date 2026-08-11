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
  status: ConflictStatus;
  severity: ConflictSeverity;
  conflictType: ConflictType | string;
  summary: string;
  detectedAt: string;
  frozenPermitId?: string | null;
  requiresJointAck?: boolean;
  ackUserA?: string | null;
  ackUserB?: string | null;
  escalateAfter?: string | null;
  escalatedAt?: string | null;
  escalatedToRole?: string | null;
};

export type ConflictParticipant = {
  id: string;
  permit: {
    id: string;
    reference: string | null;
    title: string;
    status?: string;
    plannedStartAt: string | null;
    plannedEndAt: string | null;
  };
};

export type ConflictAssessment = {
  riskSummary: string;
  assessedSeverity: ConflictSeverity;
};

export type MitigationPlan = {
  planSummary: string;
  actions: Array<{ description: string }>;
};

export type ConflictResolution = {
  outcome: "approved" | "rejected";
  comments: string;
  resolvedAt: string;
};

export type ConflictHistoryEntry = {
  id: string;
  action: string;
  createdAt: string;
};

export type ConflictDetail = {
  conflict: SimopsConflict;
  participants: ConflictParticipant[];
  assessment: ConflictAssessment | null;
  mitigation: MitigationPlan | null;
  resolution: ConflictResolution | null;
  history: ConflictHistoryEntry[];
};

export type AssessConflictPayload = {
  assessedSeverity: ConflictSeverity;
  riskSummary: string;
};

export type MitigationPlanPayload = {
  planSummary: string;
  actions: Array<{ description: string }>;
};
