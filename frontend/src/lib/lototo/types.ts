export const LOTOTO_PLAN_STATUSES = ["draft", "ready", "in_execution", "completed"] as const;
export type LototoPlanStatus = (typeof LOTOTO_PLAN_STATUSES)[number];

export const LOTOTO_ASSIGNMENT_ROLES = [
  "isolation_officer",
  "verifier",
  "supervisor",
] as const;
export type LototoAssignmentRole = (typeof LOTOTO_ASSIGNMENT_ROLES)[number];

export type LototoPlan = {
  id: string;
  tenantId: string;
  permitId: string;
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
  permitId: string;
  title: string;
  description?: string;
  workstationId?: string;
  machineryId?: string;
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
