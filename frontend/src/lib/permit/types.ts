import type { TemplateConfig } from "@/lib/organisation/templates";

export type SignatureAnswer = { name: string; date?: string; time?: string };
export type FormAnswer = string | number | string[] | SignatureAnswer;
export type FormAnswers = Record<string, FormAnswer>;

/** A permit template filled in on a permit, with the form as it was when filled in. */
export type StoredFormResponse = { templateId: string; name: string; config: TemplateConfig; answers: FormAnswers };

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
  submittedBy?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  formResponses?: StoredFormResponse[];
  createdAt: string;
  updatedAt: string;
};

export type PermitHazardInput = {
  hazardCategoryId: string;
  description: string;
};

export type PermitPpeInput = {
  ppeCatalogueId: string;
  quantity: number;
};

export type PermitLototoExtraInput = {
  pointCode: string;
  energyType: string;
  magnitude: string;
  locationText: string;
  action: string;
  device: string;
  verificationMethod: string;
};

export type PermitLototoStepNaInput = {
  basePointId?: string;
  extraPointCode?: string;
  reason: string;
};

export type PermitLototoInput = {
  procedureId: string;
  procedureVersionId?: string;
  frozenAt?: string | null;
  extraPoints: PermitLototoExtraInput[];
  stepNa: PermitLototoStepNaInput[];
  crew: PermitAssigneeInput[];
  verifiers: PermitAssigneeInput[];
};

export type PermitGasTestingInput = {
  gasTestingCatalogueId: string;
};

export type PermitAssigneeInput = {
  workforceUserId: string;
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
  plannedStartAt: string;
  plannedEndAt: string;
  hazards: PermitHazardInput[];
  ppe: PermitPpeInput[];
  lototoRequired: boolean;
  lototo: PermitLototoInput[];
  gasTestingRequired: boolean;
  gasTesting: PermitGasTestingInput[];
  executors: PermitExecutorInput[];
  viewers: PermitAssigneeInput[];
  safetyOfficers: PermitAssigneeInput[];
  /** Answers per permit template id. */
  formResponses: Record<string, FormAnswers>;
  currentStep: number;
};

export type PermitDraft = {
  id: string;
  permitId: string;
  currentStep: number;
  formSnapshot: Record<string, unknown> | null;
  lastAutosavedAt: string;
};

export type PermitAttachment = {
  id: string;
  permitId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  storageKey: string;
};

export type PermitDetail = {
  permit: PermitRecord;
  draft: PermitDraft | null;
  hazards: Array<{ hazardCategoryId: string; description: string | null }>;
  ppe: Array<{ ppeCatalogueId: string; quantity: number | null }>;
  lototo: PermitLototoInput[];
  gasTesting: Array<{ gasTestingCatalogueId: string }>;
  executors: Array<{ workforceUserId: string; isPrimary: boolean | null }>;
  viewers: Array<{ workforceUserId: string }>;
  safetyOfficers: Array<{ workforceUserId: string }>;
  attachments: PermitAttachment[];
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
  plannedStartAt?: string;
  plannedEndAt?: string;
  currentStep?: number;
  hazards?: PermitHazardInput[];
  ppe?: PermitPpeInput[];
  lototoRequired?: boolean;
  lototo?: PermitLototoInput[];
  gasTestingRequired?: boolean;
  gasTesting?: PermitGasTestingInput[];
  executors?: PermitExecutorInput[];
  viewers?: PermitAssigneeInput[];
  safetyOfficers?: PermitAssigneeInput[];
  formResponses?: { templateId: string; answers: FormAnswers }[];
};

export type SaveDraftPayload = Partial<CreatePermitPayload>;

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
  crewLatest: { lockTagId: string; reading: string | null; comment: string | null; completedAt: string } | null;
  verificationLatest: {
    result: "pass" | "fail";
    tryOutCompleted: boolean;
    reading: string | null;
    comment: string | null;
    verifiedAt: string;
  } | null;
  restoreStatus: PermitLototoPointStatus;
  restoreLatest: { lockTagId: string; comment: string | null; restoredAt: string } | null;
  restoreVerificationLatest: { result: "pass" | "fail"; comment: string | null; verifiedAt: string } | null;
};

export type PermitLototoExecutionBoard = {
  permitId: string;
  permitStatus: string;
  isolated: boolean;
  restored: boolean;
  instances: Array<{
    instanceId: string;
    procedureId: string;
    procedureCode: string;
    procedureTitle: string;
    points: PermitLototoExecutionPoint[];
  }>;
};
