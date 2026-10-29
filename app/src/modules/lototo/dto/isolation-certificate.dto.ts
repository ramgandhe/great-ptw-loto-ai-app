import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ISOLATION_CERTIFICATE_STATUSES,
  ISOLATION_DISCIPLINES,
  IsolationCertificateStatus,
  IsolationDiscipline,
} from '../../../database/schema/isolation-certificate';

export class CreateIsolationCertificateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsIn([...ISOLATION_DISCIPLINES])
  discipline?: IsolationDiscipline;

  @IsOptional()
  @IsUUID()
  procedureId?: string;

  @IsOptional()
  @IsUUID()
  procedureVersionId?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  workLocationId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsBoolean()
  isLongTerm?: boolean;

  @IsOptional()
  @IsString()
  ltiReason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ltiAuditIntervalDays?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  safetyPrecautions?: string;
}

export class UpdateIsolationCertificateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsIn([...ISOLATION_DISCIPLINES])
  discipline?: IsolationDiscipline;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  workLocationId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsBoolean()
  isLongTerm?: boolean;

  @IsOptional()
  @IsString()
  ltiReason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ltiAuditIntervalDays?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  safetyPrecautions?: string;
}

export class TransitionIsolationCertificateDto {
  @IsIn([...ISOLATION_CERTIFICATE_STATUSES])
  status!: IsolationCertificateStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApplyCertificatePointDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  positionConfirmed!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lockNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  tagNumber!: string;
}

export class RecordPointProofDto {
  @IsIn(['pass', 'fail'])
  result!: 'pass' | 'fail';

  @IsOptional()
  @IsString()
  @MaxLength(128)
  instrumentMakeModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  instrumentSerialNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  calibrationExpiryDate?: string;

  @IsObject()
  readings!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  comment?: string;
}
