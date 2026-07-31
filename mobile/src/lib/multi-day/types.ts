export type DailyProgressStatus = "draft" | "submitted";

export type DailyProgressRecord = {
  id: string;
  permitId: string;
  operationalDate: string;
  completedWork: string;
  pendingWork: string;
  summary: string;
  status: DailyProgressStatus;
  submittedAt: string | null;
};

export type ShiftHandoverRecord = {
  id: string;
  permitId: string;
  incomingUserId: string;
  completedActivities: string;
  outstandingWork: string;
  safetyObservations: string;
  handedOverAt: string;
};

export type DailyActivityEvent = {
  id: string;
  eventType: string;
  createdAt: string;
};

export type RevalidationOutcome = "passed" | "failed";

export type RevalidationHistoryEvent = {
  id: string;
  eventType: string;
  createdAt: string;
};

export type RecordDailyProgressPayload = {
  operationalDate: string;
  completedWork: string;
  pendingWork?: string;
  summary: string;
  submit?: boolean;
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
};

export type RequestExtensionPayload = {
  requestedEndAt: string;
  justification: string;
};
