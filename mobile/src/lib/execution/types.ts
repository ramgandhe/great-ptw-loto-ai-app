import type { PermitRecord } from "@/lib/permit/types";

export type WorkUiState = "not_started" | "in_progress" | "paused" | "completed" | "suspended";

export type WorkChecklistItem = {
  key: string;
  label: string;
  required: boolean;
};

export type WorkCycleSnapshot = {
  workUiState: WorkUiState;
  canPause: boolean;
  canResume: boolean;
  canComplete: boolean;
  canRecordProgress: boolean;
  missingPriorSecureDates?: string[];
  pastCutoff?: boolean;
  crewRosterRequired?: boolean;
  suggestedCrew?: Array<{ workforceUserId: string; role: "primary" | "substitute" }>;
  handoverRequired?: boolean;
  handoverAccepted?: boolean;
  overnightIsolationPolicy: "hold" | "restore_allowed";
  dailyRevalidationRequired: boolean;
  pauseTemplate: { title: string; items: WorkChecklistItem[] };
  resumeTemplate: {
    title: string;
    mode: string;
    reisolateRequired: boolean;
    simopsBlocked?: boolean;
    simopsBlockReason?: string | null;
    items: WorkChecklistItem[];
  };
};

export type PermitExecution = {
  id: string;
  permitId: string;
  activatedAt: string;
  activatedBy: string;
  actualStartAt: string;
  workState?: string | null;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
  resumedAt: string | null;
  resumedBy: string | null;
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
  execution: PermitExecution;
  permit: PermitRecord;
};

export type PendingProgressItem = {
  id: string;
  permitId: string;
  summary: string;
  createdAt: string;
};

export type PendingEvidenceItem = {
  id: string;
  permitId: string;
  uri: string;
  fileName: string;
  contentType: string;
  comment?: string;
  createdAt: string;
};
