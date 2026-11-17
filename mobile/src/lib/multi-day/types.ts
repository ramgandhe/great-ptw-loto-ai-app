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

export type HandoverStatus = "pending_acceptance" | "accepted" | "rejected" | "cancelled";

export type ShiftHandoverRecord = {
  id: string;
  permitId: string;
  outgoingUserId?: string;
  incomingUserId: string;
  completedActivities: string;
  outstandingWork: string;
  safetyObservations: string;
  handedOverAt: string;
  status?: HandoverStatus;
  acceptanceNotes?: string;
  custodyHeldBy?: string;
};

export type DecideShiftHandoverPayload = {
  notes?: string;
  lototoCustodyAcknowledged?: boolean;
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
  payload?: Record<string, unknown> | null;
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

export type DaySecureChecklistTemplate = {
  mode: "light" | "full";
  requiredKeys: string[];
  items: Array<{ key: string; label: string; required: boolean }>;
};

export type DaySecureRecord = {
  id: string;
  permitId: string;
  operationalDate: string;
  status: "pending_countersign" | "submitted";
  late: boolean;
  lateReason: string | null;
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
  overnightIsolationRemains?: boolean;
  todaySecureComplete?: boolean;
  pastCutoff?: boolean;
  progressSubmittedToday?: boolean;
  requiredAction?: {
    key: string;
    hash: string;
    label: string;
    href: string;
  };
};

export type ReopenCompositionModule = {
  key: "site_security" | "toolbox" | "crew" | "ppe_hazard" | "gas" | "lototo" | "simops";
  required: boolean;
  label: string;
  reason: string;
  href: string;
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
  openIsolationsRemain?: boolean;
  openIsolationCount?: number;
  overnightIsolationRemains?: boolean;
  toolboxTalkRecorded?: boolean;
  crewCount?: number;
  modules: ReopenCompositionModule[];
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
