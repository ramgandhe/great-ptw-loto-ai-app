import type { FormAnswers, StoredFormResponse } from "./forms";

export type PermitRecord = {
  id: string;
  tenantId: string;
  reference: string | null;
  status: string;
  permitTypeId: string;
  title: string;
  workScope: string | null;
  plantId: string | null;
  departmentId: string | null;
  locationId: string | null;
  workstationId: string | null;
  machineryId: string | null;
  lototoRequired?: boolean;
  gasTestingRequired?: boolean;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  submittedAt: string | null;
  /** Send back on every save and submit; the server refuses an older one with PERMIT_REVISION_CONFLICT. */
  draftRevision: number;
  /** Filled-in forms and check sheets, each with the form as it was when filled in. */
  formResponses?: StoredFormResponse[];
  createdAt: string;
  updatedAt: string;
};

export type PermitHazardInput = {
  hazardCategoryId: string;
  extraConsequences: string[];
  extraControls: string[];
};

export type PermitPpeInput = {
  ppeCatalogueId: string;
  quantity: number;
};

export type PermitLototoInput = {
  procedureId: string;
  extraPoints?: unknown[];
  stepNa?: unknown[];
  crew?: unknown[];
  verifiers?: unknown[];
};

export type PermitGasTestingInput = {
  gasTestingCatalogueId: string;
};

export type PermitExecutorInput = {
  workforceUserId: string;
  isPrimary: boolean;
};

export type PermitFormState = {
  permitTypeId: string;
  title: string;
  workScope: string;
  plantId: string;
  departmentId: string;
  locationId: string;
  workstationId: string;
  machineryId: string;
  lototoRequired: boolean;
  plannedStartAt: string;
  plannedEndAt: string;
  hazards: PermitHazardInput[];
  ppe: PermitPpeInput[];
  lototo: PermitLototoInput[];
  gasTestingRequired: boolean;
  gasTesting: PermitGasTestingInput[];
  executors: PermitExecutorInput[];
  /** Answers per template id. */
  formResponses: Record<string, FormAnswers>;
  currentStep: number;
};

export type PermitDetail = {
  permit: PermitRecord;
  draft: {
    currentStep: number;
    formSnapshot: Record<string, unknown> | null;
  } | null;
  hazards: Array<{
    hazardCategoryId: string;
    extraConsequences?: string[] | null;
    extraControls?: string[] | null;
  }>;
  ppe: Array<{ ppeCatalogueId: string; quantity: number | null }>;
  lototo?: Array<{ procedureId: string }>;
  gasTesting?: Array<{ gasTestingCatalogueId: string }>;
  executors: Array<{ workforceUserId: string; isPrimary: boolean | null }>;
  attachments: Array<{ id: string; fileName: string; fileSize: number }>;
};

export type PermitLototoPointStatus = "na" | "pending_crew" | "pending_verify" | "failed" | "passed";

export type PermitLototoExecutionPoint = {
  basePointId: string | null;
  extraPointId: string | null;
  pointCode: string;
  energyType: string;
  action: string | null;
  locationText: string | null;
  na: boolean;
  naReason: string | null;
  status: PermitLototoPointStatus;
  restoreStatus: PermitLototoPointStatus;
};

export type PermitLototoExecutionBoard = {
  permitId: string;
  permitStatus: string;
  isolated: boolean;
  restored: boolean;
  instances: Array<{
    instanceId: string;
    procedureCode: string;
    procedureTitle: string;
    points: PermitLototoExecutionPoint[];
  }>;
};

export type CreatePermitPayload = {
  permitTypeId: string;
  title: string;
  workScope?: string;
  plantId?: string;
  departmentId?: string;
  locationId?: string;
  workstationId?: string;
  machineryId?: string;
  lototoRequired?: boolean;
  plannedStartAt?: string;
  plannedEndAt?: string;
  currentStep?: number;
  hazards?: PermitHazardInput[];
  ppe?: PermitPpeInput[];
  lototo?: PermitLototoInput[];
  gasTestingRequired?: boolean;
  gasTesting?: PermitGasTestingInput[];
  executors?: PermitExecutorInput[];
  formResponses?: { templateId: string; answers: FormAnswers }[];
};

export type DraftFields = Partial<CreatePermitPayload>;
export type SaveDraftPayload = DraftFields & { expectedRevision: number };
