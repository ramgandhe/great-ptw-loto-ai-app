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
  executors: PermitExecutorInput[];
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
  executors: Array<{ workforceUserId: string; isPrimary: boolean | null }>;
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
  executors?: PermitExecutorInput[];
};

export type SaveDraftPayload = Partial<CreatePermitPayload>;
