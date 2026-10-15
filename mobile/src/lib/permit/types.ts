import type { FormAnswers, StoredFormResponse } from "./forms";

export type PermitRecord = {
  id: string;
  tenantId: string;
  reference: string | null;
  status: string;
  permitTypeId: string;
  title: string;
  workScope: string | null;
  emergencyPhone?: string | null;
  plantId: string | null;
  departmentId: string | null;
  locationId: string | null;
  workstationId: string | null;
  machineryId: string | null;
  siteId: string | null;
  workLocationId: string | null;
  exactSpot?: string | null;
  placePath?: string | null;
  lototoRequired?: boolean;
  gasTestingRequired?: boolean;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  submittedAt: string | null;
  submittedSignedName?: string | null;
  permitVersion?: number;
  permitVersionAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  approvedSignedName?: string | null;
  safetyApprovalComment?: string | null;
  safetyApprovalSignedName?: string | null;
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
  omittedConsequences: string[];
  omittedControls: string[];
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
  gasTestingCatalogueId?: string;
  parameter?: string;
  unit?: string;
  minimum?: number;
  maximum?: number;
  removedReason?: string;
  sourceName?: string;
};

export type PermitExecutorInput = {
  workforceUserId: string;
  isPrimary: boolean;
};

export type PermitFormState = {
  permitTypeId: string;
  title: string;
  workScope: string;
  emergencyPhone: string;
  plantId: string;
  departmentId: string;
  locationId: string;
  workstationId: string;
  machineryId: string;
  siteId: string;
  workLocationId: string;
  exactSpot: string;
  assetIds: string[];
  /** False until gas defaults for the current place and assets have been applied. */
  gasReady: boolean;
  lototoRequired: boolean;
  plannedStartAt: string;
  plannedEndAt: string;
  hazards: PermitHazardInput[];
  ppe: PermitPpeInput[];
  lototo: PermitLototoInput[];
  gasTestingRequired: boolean;
  gasTesting: PermitGasTestingInput[];
  executors: PermitExecutorInput[];
  safetyOfficers: { workforceUserId: string }[];
  safetyApprovalComment: string;
  safetyApprovalSignedName: string;
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
    omittedConsequences?: string[] | null;
    omittedControls?: string[] | null;
  }>;
  ppe: Array<{ ppeCatalogueId: string; quantity: number | null }>;
  lototo?: Array<{ procedureId: string }>;
  gasTesting?: PermitGasTestingInput[];
  assets?: Array<{ assetId: string }>;
  executors: Array<{ workforceUserId: string; isPrimary: boolean | null }>;
  safetyOfficers?: Array<{ workforceUserId: string }>;
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
  emergencyPhone?: string;
  plantId?: string;
  departmentId?: string;
  locationId?: string;
  workstationId?: string;
  machineryId?: string;
  siteId?: string;
  workLocationId?: string;
  exactSpot?: string;
  assetIds?: string[];
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
