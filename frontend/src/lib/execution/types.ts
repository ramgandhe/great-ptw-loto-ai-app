import type { PermitRecord } from "@/lib/permit/types";

export type WorkUiState = "not_started" | "in_progress" | "paused" | "completed" | "suspended";

export type WorkChecklistItem = {
  key: string;
  label: string;
  required: boolean;
};

export type PermitExecution = {
  id: string;
  permitId: string;
  activatedAt: string;
  activatedBy: string;
  actualStartAt: string;
  workState?: string | null;
  workPausedAt?: string | null;
  workPausedBy?: string | null;
  workResumedAt?: string | null;
  workResumedBy?: string | null;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
  resumedAt: string | null;
  resumedBy: string | null;
};

export type LototoOvernightItem = {
  id: string;
  kind: "crew_lock" | "isolation_point";
  label: string;
};

export type WorkHistoryEvent = {
  id: string;
  kind: "paused" | "resumed";
  at: string;
  by: string;
  summary?: string;
  pauseId?: string;
  reisolateRequiredOnResume?: boolean;
};

export type WorkCycleSnapshot = {
  workUiState: WorkUiState;
  workState: string | null;
  canPause: boolean;
  canResume: boolean;
  canComplete: boolean;
  canRecordProgress: boolean;
  missingPriorSecureDates?: string[];
  /** Multi-day work still in progress after today's operational cut-off. */
  pastCutoff?: boolean;
  /** First resume of a new day, and the organisation requires a roster that is not saved yet. */
  crewRosterRequired?: boolean;
  suggestedCrew?: Array<{ workforceUserId: string; role: "primary" | "substitute" }>;
  /** Resuming user is not the person who paused. */
  handoverRequired?: boolean;
  /** Same person, or an accepted handover from the pauser to this user after the pause. */
  handoverAccepted?: boolean;
  overnightIsolationPolicy: "hold" | "restore_allowed";
  dailyRevalidationRequired: boolean;
  lototoRequired?: boolean;
  lototoOvernightItems?: LototoOvernightItem[];
  history?: WorkHistoryEvent[];
  openPause: {
    id: string;
    summary: string;
    pausedAt: string;
    operationalDate: string;
    reisolateRequiredOnResume: boolean;
    overnightRestoreChosen: boolean;
    lototoRemovals: string[];
  } | null;
  pauseTemplate: {
    purpose: string;
    title: string;
    mode: string;
    items: WorkChecklistItem[];
  };
  resumeTemplate: {
    purpose: string;
    title: string;
    mode: string;
    reisolateRequired: boolean;
    simopsBlocked?: boolean;
    simopsBlockReason?: string | null;
    items: WorkChecklistItem[];
  };
  execution: {
    id: string;
    workState: string;
    workPausedAt: string | null;
    workResumedAt: string | null;
    suspendedAt: string | null;
    actualStartAt: string;
  } | null;
};

export type ProgressRecord = {
  id: string;
  permitId: string;
  executionId: string;
  summary: string;
  recordedBy: string;
  recordedAt: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type EvidenceRecord = {
  id: string;
  permitId: string;
  executionId: string;
  progressId: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
  storageBucket: string;
  storageKey: string;
  checksum: string | null;
  comment: string | null;
  uploadedBy: string;
  createdAt: string;
};

export type ExecutionActionResult = {
  execution: PermitExecution | null;
  permit: PermitRecord;
};
