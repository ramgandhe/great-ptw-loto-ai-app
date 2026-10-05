export const LOTOTO_PLAN_STATUSES = ["draft", "ready", "in_execution", "completed"] as const;
export type LototoPlanStatus = (typeof LOTOTO_PLAN_STATUSES)[number];

export const LOTOTO_ASSIGNMENT_ROLES = [
  "operator",
  "safety-officer",
  "hod",
] as const;
export type LototoAssignmentRole = (typeof LOTOTO_ASSIGNMENT_ROLES)[number];

export type LototoPlan = {
  id: string;
  tenantId: string;
  permitId: string | null;
  workstationId: string | null;
  machineryId: string | null;
  reference: string | null;
  title: string;
  description: string | null;
  status: LototoPlanStatus;
  createdAt: string;
  updatedAt: string;
};

export type IsolationPoint = {
  id: string;
  planId: string;
  machineryId: string;
  equipmentEnergySourceId: string | null;
  isolationNumber: string;
  description: string | null;
  verificationRequired: boolean;
};

export type LototoAssignment = {
  id: string;
  planId: string;
  workforceUserId: string;
  role: LototoAssignmentRole;
  assignedAt: string;
};

export type CreateLototoPlanPayload = {
  machineryId: string;
  title: string;
  description?: string;
  workstationId?: string;
  reference?: string;
};

export type EnergySourcePayload = {
  energySourceType: string;
  description?: string;
  lockMethod?: string;
  tagType?: string;
};

export type AddIsolationPointPayload = {
  machineryId: string;
  isolationNumber: string;
  description?: string;
  verificationRequired?: boolean;
  equipmentEnergySourceId?: string;
  energySource?: EnergySourcePayload;
};

export type AssignPersonnelPayload = {
  workforceUserId: string;
  role: LototoAssignmentRole;
};

export type SequenceStepPayload = {
  isolationPointId: string;
  sequenceOrder: number;
  requiresVerification?: boolean;
};

export type ConfigureSequencePayload = {
  steps: SequenceStepPayload[];
};

export type IsolationSequenceStep = {
  id: string;
  planId: string;
  isolationPointId: string;
  sequenceOrder: number;
  requiresVerification: boolean;
};

export type LototoPlanDetail = {
  plan: LototoPlan;
  isolationPoints: IsolationPoint[];
  assignments: LototoAssignment[];
  sequence: IsolationSequenceStep[];
};

export type LototoLockoutPoint = {
  id?: string;
  sortOrder: number;
  pointCode: string;
  energyType: string;
  magnitude?: string | null;
  locationText?: string | null;
  action?: string | null;
  device?: string | null;
  verificationMethod?: string | null;
  photo?: { id: string; fileName: string; url: string } | null;
};

export type LototoSequenceStep = {
  id?: string;
  phase: "apply" | "remove";
  sequenceOrder: number;
  title: string;
  description?: string | null;
};

export type LototoProcedureVersion = {
  id: string;
  versionNumber: number;
  publishedAt: string | null;
  facility?: string | null;
  locationText?: string | null;
  purpose?: string | null;
  scope?: string | null;
  authorization?: string | null;
  enforcement?: string | null;
  description?: string | null;
  note?: string | null;
  lockoutPoints: LototoLockoutPoint[];
  sequenceSteps: LototoSequenceStep[];
  authorizedRoles: string[];
};

export type LototoProcedure = {
  id: string;
  machineryId: string;
  workstationId: string | null;
  code: string;
  title: string;
  status: "draft" | "published" | "inactive";
  publishedVersionId: string | null;
  versions: { id: string; versionNumber: number; publishedAt: string | null }[];
  publishedVersion: LototoProcedureVersion | null;
  draftVersion: LototoProcedureVersion | null;
};

export type LototoProcedureListItem = {
  id: string;
  machineryId: string;
  workstationId: string | null;
  code: string;
  title: string;
  status: "draft" | "published" | "inactive";
  publishedVersionId: string | null;
};

export type LototoProcedurePayload = {
  machineryId: string;
  workstationId?: string;
  code: string;
  title: string;
  facility?: string;
  locationText?: string;
  purpose?: string;
  scope?: string;
  authorization?: string;
  enforcement?: string;
  description?: string;
  note?: string;
  lockoutPoints?: LototoLockoutPoint[];
  sequenceSteps?: LototoSequenceStep[];
  authorizedRoles?: string[];
};

