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

export type HandoverStatus = "pending_acceptance" | "accepted" | "rejected" | "cancelled";

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
  status: HandoverStatus;
  acceptedBy?: string | null;
  acceptedAt?: string | null;
  acceptanceNotes?: string;
  custodyHeldBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type DecideShiftHandoverPayload = {
  notes?: string;
  lototoCustodyAcknowledged?: boolean;
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

export type ReopenCompositionModule = {
  key: "site_security" | "toolbox" | "crew" | "ppe_hazard" | "gas" | "lototo" | "simops";
  required: boolean;
  label: string;
  reason: string;
  href: string;
  satisfied: boolean;
  blockers: string[];
};

export type ReopenComposition = {
  isMultiDay: boolean;
  dailyRevalidationRequired: boolean;
  operationalDate: string;
  siteSecurity: Array<{ key: string; label: string; required: boolean }>;
  gasItems: Array<{
    gasTestingCatalogueId: string;
    parameter: string;
    minimum: number;
    maximum: number;
    unit: string;
  }>;
  requiredHazardKeys?: string[];
  requiredPpeIds?: string[];
  openIsolationsRemain?: boolean;
  openIsolationCount?: number;
  overnightIsolationRemains?: boolean;
  toolboxTalkRecorded?: boolean;
  crewCount?: number;
  modules: ReopenCompositionModule[];
  links: { gas: string; lototo: string; simops: string; toolbox?: string; crew?: string };
};

export type ToolboxTalkRecord = {
  id: string;
  permitId: string;
  operationalDate: string;
  topic: string;
  conductedBy: string;
  attendeeUserIds: string[];
  notes: string;
  conductedAt: string;
};

export type DailyCrewMember = {
  id: string;
  permitId: string;
  operationalDate: string;
  workforceUserId: string;
  role: "primary" | "substitute";
  substituteForUserId: string | null;
  notes: string;
};

export type RequestExtensionPayload = {
  requestedEndAt: string;
  justification: string;
};

export type PermitOvertimeRequest = {
  id: string;
  tenantId: string;
  permitId: string;
  operationalDate: string;
  requestedUntil: string;
  justification: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionComments: string | null;
};

export type RequestOvertimePayload = {
  requestedUntil: string;
  justification: string;
};

export type PendingTimeRequests = {
  extensions: PermitExtension[];
  overtime: PermitOvertimeRequest[];
};

export type DecideExtensionPayload = {
  comments?: string;
};

export type DaySecureChecklistItem = {
  key: string;
  label: string;
  required: boolean;
};

export type DaySecureChecklistTemplate = {
  mode: "light" | "full";
  requiredKeys: string[];
  items: DaySecureChecklistItem[];
};

export type DaySecureRecord = {
  id: string;
  permitId: string;
  operationalDate: string;
  checklist: Record<string, unknown>;
  notes: string;
  personnelCleared: boolean;
  late: boolean;
  lateReason: string | null;
  securedBy: string;
  securedAt: string;
  countersignedBy: string | null;
  countersignedAt: string | null;
  status: "pending_countersign" | "submitted";
};

export type DayCycleRequiredAction = {
  key: string;
  hash: string;
  label: string;
  href: string;
};

export type DayCycleSnapshot = {
  isMultiDay: boolean;
  dayCycleState: string;
  currentOperationalDate: string | null;
  missingPriorSecureDates: string[];
  lateSecureRequired: boolean;
  finalDay: string | null;
  dailyRevalidationRequired?: boolean;
  emergencyOverrideAllowed?: boolean;
  startOperationalDate?: string;
  endOperationalDate?: string;
  dayNumber?: number | null;
  maxMultiDayValidityDays?: number;
  operationalDayCutoff?: string;
  timezone?: string;
  clearedForWorkToday?: boolean;
  overrideUsedToday?: boolean;
  overnightIsolationRemains?: boolean;
  todaySecureComplete?: boolean;
  pastCutoff?: boolean;
  progressSubmittedToday?: boolean;
  requiredAction?: DayCycleRequiredAction;
};

export type CreateDaySecurePayload = {
  operationalDate: string;
  personnelCleared: boolean;
  checklist: {
    workAreaLeftSafe: boolean;
    materialsToolsSecured: boolean;
    isolationsIntact?: boolean;
    openingsBarricaded?: boolean;
    emergencyAccessClear?: boolean;
    overnightHazardsNoted?: boolean;
  };
  notes?: string;
  lateReason?: string;
};

export type CountersignDaySecurePayload = {
  notes?: string;
};

export type MdpEvidenceKind = "daily_progress" | "day_secure" | "reopen";

export type MdpEvidenceRecord = {
  id: string;
  tenantId: string;
  permitId: string;
  kind: MdpEvidenceKind;
  operationalDate: string | null;
  dailyProgressId: string | null;
  daySecureId: string | null;
  revalidationId: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
  comment: string | null;
  uploadedBy: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
};
