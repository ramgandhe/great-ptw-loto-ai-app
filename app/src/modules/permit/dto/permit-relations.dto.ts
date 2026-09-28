import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMaxSize,
  Min,
  ValidateNested,
} from 'class-validator';

export class PermitHazardDto {
  @IsUUID()
  hazardCategoryId!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class PermitPpeDto {
  @IsUUID()
  ppeCatalogueId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class PermitLototoDto {
  @IsUUID()
  lototoPlanId!: string;
}

export class PermitGasTestingDto {
  @IsUUID()
  gasTestingCatalogueId!: string;
}

export class PermitExecutorDto {
  @IsUUID()
  workforceUserId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class PermitAssigneeDto {
  @IsUUID()
  workforceUserId!: string;
}

/** Answers to one permit template, keyed by the template's field ids. */
export class PermitFormResponseDto {
  @IsUUID()
  templateId!: string;

  @IsObject()
  answers!: Record<string, unknown>;
}

export class PermitRelationsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PermitFormResponseDto)
  formResponses?: PermitFormResponseDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitHazardDto)
  hazards?: PermitHazardDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitPpeDto)
  ppe?: PermitPpeDto[];

  @IsOptional()
  @IsBoolean()
  lototoRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitLototoDto)
  lototo?: PermitLototoDto[];

  @IsOptional()
  @IsBoolean()
  gasTestingRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitGasTestingDto)
  gasTesting?: PermitGasTestingDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitExecutorDto)
  executors?: PermitExecutorDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitAssigneeDto)
  viewers?: PermitAssigneeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitAssigneeDto)
  safetyOfficers?: PermitAssigneeDto[];
}
