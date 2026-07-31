import type { LototoPlan } from "@/lib/lototo/types";

export const ISOLATION_EXECUTION_STATUSES = [
  "in_progress",
  "isolated",
  "verified",
  "restored",
] as const;
export type IsolationExecutionStatus = (typeof ISOLATION_EXECUTION_STATUSES)[number];

export const VERIFICATION_RESULTS = ["pass", "fail"] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

export type IsolationExecution = {
  id: string;
  tenantId: string;
  planId: string;
  status: IsolationExecutionStatus;
  startedBy: string;
  startedAt: string;
  isolatedAt: string | null;
  verifiedAt: string | null;
  restoredAt: string | null;
};

export type SequenceStep = {
  sequenceOrder: number;
  requiresVerification: boolean;
  isolationPointId: string;
  isolationNumber: string;
  description: string | null;
};

export type AppliedLock = {
  id: string;
  executionId: string;
  isolationPointId: string;
  lockTag: string;
  lockMethod: string;
  status: string;
  appliedBy: string;
  appliedAt: string;
};

export type AppliedTag = {
  id: string;
  executionId: string;
  isolationPointId: string;
  tagNumber: string;
  tagType: string;
  reason: string | null;
  status: string;
  appliedBy: string;
  appliedAt: string;
};

export type IsolationVerification = {
  id: string;
  executionId: string;
  isolationPointId: string;
  result: VerificationResult;
  method: string | null;
  comment: string | null;
  verifiedBy: string;
  verifiedAt: string;
};

export type IsolationEvidence = {
  id: string;
  executionId: string;
  isolationPointId: string | null;
  verificationId: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
  storageKey: string;
  capturedBy: string;
  capturedAt: string;
};

export type IsolationExecutionDetail = {
  execution: IsolationExecution;
  plan: LototoPlan | null;
  sequence: SequenceStep[];
  locks: AppliedLock[];
  tags: AppliedTag[];
  verifications: IsolationVerification[];
  evidence: IsolationEvidence[];
};

export type ApplyLockPayload = {
  isolationPointId: string;
  lockTag: string;
  lockMethod: string;
};

export type ApplyTagPayload = {
  isolationPointId: string;
  tagNumber: string;
  tagType: string;
  reason?: string;
};

export type RecordVerificationPayload = {
  isolationPointId: string;
  result: VerificationResult;
  method?: string;
  comment?: string;
};

export type EvidenceUploadUrlResult = {
  storageBucket: string;
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
};
