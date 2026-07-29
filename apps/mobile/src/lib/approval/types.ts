import type { PermitDetail, PermitRecord } from "@/lib/permit/types";

export type WorkflowStep = {
  id: string;
  stepSequence: number;
  name: string;
  approverRole: string;
  commentRequiredOnApprove: boolean;
  commentRequiredOnReject: boolean;
  commentRequiredOnDefer: boolean;
};

export type WorkflowAssignment = {
  id: string;
  permitId: string;
  workflowStepId: string;
  assigneeId: string;
  status: string;
  assignedAt: string;
  completedAt: string | null;
};

export type PendingApprovalItem = {
  assignment: WorkflowAssignment;
  step: WorkflowStep;
  permit: PermitRecord;
};

export type PermitApprovalDecision = {
  id: string;
  permitId: string;
  workflowStepId: string;
  decision: string;
  comment: string | null;
  decidedBy: string;
  decidedAt: string;
};

export type ApprovalHistoryEntry = {
  id: string;
  permitId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string;
  comment: string | null;
  workflowStepId: string | null;
  createdAt: string;
};

export type WorkflowAssignmentRow = {
  assignment: WorkflowAssignment;
  step: WorkflowStep;
};

export type ApprovalReview = PermitDetail & {
  workflow: WorkflowAssignmentRow[];
  activeAssignment: WorkflowAssignmentRow | null;
  decisions: PermitApprovalDecision[];
};
