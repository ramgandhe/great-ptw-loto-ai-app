import type { PermitRecord } from "@/lib/permit/types";

export type PermitExecutionRecord = {
  id: string;
  tenantId: string;
  permitId: string;
  activatedAt: string;
  activatedBy: string;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
  resumedAt: string | null;
  resumedBy: string | null;
};

export type ProgressRecord = {
  id: string;
  permitId: string;
  summary: string;
  recordedBy: string;
  recordedAt: string;
};

export type EvidenceRecord = {
  id: string;
  permitId: string;
  progressId: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
  comment: string | null;
  uploadedBy: string;
  createdAt: string;
};

export type StatusHistoryRecord = {
  id: string;
  permitId: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  changedBy: string;
  changedAt: string;
};

export type ExecutionDetail = {
  permit: PermitRecord;
  execution: PermitExecutionRecord | null;
  progress: ProgressRecord[];
  evidence: EvidenceRecord[];
  history: StatusHistoryRecord[];
};
