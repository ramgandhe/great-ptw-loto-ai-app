import type { PermitDetail, PermitRecord } from "@/lib/permit/types";

export type VerificationChecklist = {
  workCompleted: boolean;
  evidenceReviewed: boolean;
  areaSecured: boolean;
  hazardsRemoved: boolean;
};

export type PermitVerification = {
  id: string;
  permitId: string;
  verifiedBy: string;
  verifiedAt: string;
  comment: string | null;
  checklist: VerificationChecklist;
};

export type PermitClosure = {
  id: string;
  permitId: string;
  closedBy: string;
  closedAt: string;
  actualEndAt: string;
  comment: string | null;
};

export type ArchivedPermitSummary = {
  permit: PermitRecord;
  closedAt: string;
  closedBy: string;
};

export type PermitHistoryEntry = {
  id: string;
  permitId: string;
  action: string;
  actorId: string;
  comment: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export type ClosureReview = PermitDetail & {
  verification: PermitVerification | null;
  closure: PermitClosure | null;
};

export type ArchivedPermitDetail = ClosureReview;

export type VerifyPermitResult = {
  verification: PermitVerification;
  permit: PermitRecord;
};

export type ClosePermitResult = {
  closure: PermitClosure;
  permit: PermitRecord;
};

export type ArchiveSearchParams = {
  q?: string;
  from?: string;
  to?: string;
};
