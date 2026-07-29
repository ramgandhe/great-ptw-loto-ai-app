import type { PermitRecord } from "@/lib/permit/types";

export type PermitExecution = {
  id: string;
  permitId: string;
  activatedAt: string;
  activatedBy: string;
  actualStartAt: string;
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
