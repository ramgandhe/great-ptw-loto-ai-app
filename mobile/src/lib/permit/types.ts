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

export type PermitLototoInput = {
  lototoPlanId: string;
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
  currentStep: number;
};

export type PermitDetail = {
  permit: PermitRecord;
  draft: {
    currentStep: number;
    formSnapshot: Record<string, unknown> | null;
  } | null;
  hazards: Array<{ hazardCategoryId: string; description: string | null }>;
  ppe: Array<{ ppeCatalogueId: string; quantity: number | null }>;
  lototo?: Array<{ lototoPlanId: string }>;
  gasTesting?: Array<{ gasTestingCatalogueId: string }>;
  executors: Array<{ workforceUserId: string; isPrimary: boolean | null }>;
  attachments: Array<{ id: string; fileName: string; fileSize: number }>;
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
};

export type SaveDraftPayload = Partial<CreatePermitPayload>;
