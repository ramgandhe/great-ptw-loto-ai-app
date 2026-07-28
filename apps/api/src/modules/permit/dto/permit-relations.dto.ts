import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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

export class PermitExecutorDto {
  @IsUUID()
  workforceUserId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class PermitRelationsDto {
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitExecutorDto)
  executors?: PermitExecutorDto[];
}
