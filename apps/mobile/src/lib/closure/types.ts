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

export type VerifyPermitResult = {
  verification: PermitVerification;
  permit: PermitRecord;
};

export type ClosePermitResult = {
  closure: PermitClosure;
  permit: PermitRecord;
};

export type ArchivedPermitDetail = PermitDetail & {
  verification: PermitVerification | null;
  closure: PermitClosure | null;
};

export type PendingVerificationItem = {
  id: string;
  permitId: string;
  checklist: VerificationChecklist;
  comment?: string;
  createdAt: string;
};

export const defaultVerificationChecklist: VerificationChecklist = {
  workCompleted: false,
  evidenceReviewed: false,
  areaSecured: false,
  hazardsRemoved: false,
};
