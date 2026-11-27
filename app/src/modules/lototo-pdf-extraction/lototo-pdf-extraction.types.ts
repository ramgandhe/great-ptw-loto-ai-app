import type { CreateLototoProcedureDto } from '../lototo/dto/lototo-procedure.dto';

export type LototoPdfWarning = {
  field: string;
  message: string;
  code: string;
};

export type LototoPdfImageRef = {
  /** Index into the images extracted from the PDF, in document order. */
  index: number;
  pointCode?: string;
  phase?: 'apply' | 'remove';
  sequenceOrder?: number;
};

export type LototoPdfTenantHints = {
  assets: Array<{ code: string; name: string }>;
  workLocations: Array<{ code: string; name: string }>;
};

export type LototoPdfPage = {
  pageNumber: number;
  text: string;
  png: Buffer;
};

export type LototoPdfTextLine = {
  pageNumber: number;
  text: string;
  centerY: number;
};

export type LototoPdfExtractedImage = {
  index: number;
  fileName: string;
  contentType: 'image/png' | 'image/jpeg';
  bytes: Buffer;
  pageNumber: number;
  centerY: number;
  height: number;
};

export type LototoPdfExtractionResult = {
  dto: CreateLototoProcedureDto;
  procedureCode: string;
  assetCode?: string;
  workLocationCode?: string;
  images: LototoPdfImageRef[];
  warnings: LototoPdfWarning[];
};

export type LototoPdfLlmDraft = {
  code?: string;
  title?: string;
  assetCode?: string;
  workLocationCode?: string;
  facility?: string;
  locationText?: string;
  purpose?: string;
  scope?: string;
  authorization?: string;
  enforcement?: string;
  description?: string;
  note?: string;
  reviewDueOn?: string;
  lockoutPoints?: Array<Record<string, unknown>>;
  sequenceSteps?: Array<Record<string, unknown>>;
  images?: Array<Record<string, unknown>>;
};
