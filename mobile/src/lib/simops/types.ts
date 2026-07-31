export type ConflictStatus =
  | "open"
  | "assessed"
  | "mitigation_planned"
  | "approved"
  | "rejected";
export type ConflictSeverity = "low" | "medium" | "high";

export type SimopsConflict = {
  id: string;
  status: ConflictStatus;
  severity: ConflictSeverity;
  conflictType: string;
  summary: string;
  detectedAt: string;
};

export type ConflictParticipant = {
  id: string;
  permit: {
    id: string;
    reference: string | null;
    title: string;
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
