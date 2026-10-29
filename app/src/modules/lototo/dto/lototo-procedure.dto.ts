import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LOTOTO_SEQUENCE_PHASES } from '../../../database/schema/lototo-procedure';
import { LOTOTO_ISOLATION_METHODS, LOTOTO_PROOFS } from '../lototo-point';

export class LototoLockoutPointDto {
  @IsInt()
  @Min(1)
  sortOrder!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  pointCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  energyType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  energyOtherText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  magnitude?: string;

  @IsOptional()
  @IsString()
  locationText?: string;

  @IsOptional()
  @IsIn([...LOTOTO_ISOLATION_METHODS])
  method?: (typeof LOTOTO_ISOLATION_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  normalPosition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  isolatedPosition?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  restoreAction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  device?: string;

  @IsOptional()
  @IsIn([...LOTOTO_PROOFS])
  proof?: (typeof LOTOTO_PROOFS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  drawingReference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  removeOrder?: number;

  @IsOptional()
  @IsString()
  verificationMethod?: string;
}

export class LototoSequenceStepDto {
  @IsIn([...LOTOTO_SEQUENCE_PHASES])
  phase!: (typeof LOTOTO_SEQUENCE_PHASES)[number];

  @IsInt()
  @Min(1)
  sequenceOrder!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  infoText?: string;

  @IsOptional()
  @IsString()
  verification?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class LototoProcedureContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  facility?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationText?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  authorization?: string;

  @IsOptional()
  @IsString()
  enforcement?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LototoLockoutPointDto)
  lockoutPoints?: LototoLockoutPointDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LototoSequenceStepDto)
  sequenceSteps?: LototoSequenceStepDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  authorizedRoles?: string[];
}

export class CreateLototoProcedureDto extends LototoProcedureContentDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  reviewDueOn?: string | null;

  @IsOptional()
  @IsUUID()
  machineryId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsUUID()
  workLocationId?: string;

  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;
}

export class UpdateLototoProcedureDto extends LototoProcedureContentDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  reviewDueOn?: string | null;
  @IsOptional()
  @IsUUID()
  machineryId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsUUID()
  workLocationId?: string;

  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;
}
