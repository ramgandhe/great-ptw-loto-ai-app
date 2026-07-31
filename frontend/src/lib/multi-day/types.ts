export type DailyProgressStatus = "draft" | "submitted";

export type DailyProgressRecord = {
  id: string;
  tenantId: string;
  permitId: string;
  operationalDate: string;
  completedWork: string;
  pendingWork: string;
  summary: string;
  status: DailyProgressStatus;
  recordedBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  attachmentMeta?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type ShiftHandoverRecord = {
  id: string;
  tenantId: string;
  permitId: string;
  dailyProgressId: string | null;
  outgoingUserId: string;
  incomingUserId: string;
  completedActivities: string;
  outstandingWork: string;
  safetyObservations: string;
  handedOverAt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type DailyActivityEvent = {
  id: string;
  tenantId: string;
  permitId: string;
  eventType: string;
  actorId: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

export type RevalidationOutcome = "passed" | "failed";

export type PermitRevalidation = {
  id: string;
  tenantId: string;
  permitId: string;
  operationalDate: string;
  outcome: RevalidationOutcome;
  findings: string;
  checklist?: Record<string, unknown> | null;
  revalidatedBy: string;
  revalidatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PermitExtension = {
  id: string;
  tenantId: string;
  permitId: string;
  requestedEndAt: string;
  previousEndAt: string | null;
  justification: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionComments: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RevalidationHistoryEvent = {
  id: string;
  tenantId: string;
  permitId: string;
  eventType: string;
  actorId: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

export type RecordDailyProgressPayload = {
  operationalDate: string;
  completedWork: string;
  pendingWork?: string;
  summary: string;
  submit?: boolean;
  attachmentMeta?: Record<string, unknown>;
};

export type CreateShiftHandoverPayload = {
  incomingUserId: string;
  completedActivities: string;
  outstandingWork: string;
  safetyObservations?: string;
  dailyProgressId?: string;
};

export type RevalidatePermitPayload = {
  operationalDate: string;
  outcome: RevalidationOutcome;
  findings: string;
  checklist?: Record<string, unknown>;
};

export type RequestExtensionPayload = {
  requestedEndAt: string;
  justification: string;
};

export type DecideExtensionPayload = {
  comments?: string;
};
