import type { CreateLototoProcedureDto } from './dto/lototo-procedure.dto';

export type LototoImportFieldError = {
  sheet: string;
  row?: number;
  field: string;
  message: string;
  code: string;
};

export type ParsedLototoProcedureImport = {
  dto: CreateLototoProcedureDto;
  /** Raw codes before UUID resolution (for conflict messaging). */
  procedureCode: string;
  assetCode?: string;
  workLocationCode?: string;
};

export type LototoImportOverrideWarning = {
  confirmOverrideRequired: true;
  procedureId: string;
  code: string;
  status: string;
  title: string;
  hasDraft: boolean;
};
