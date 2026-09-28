import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TEMPLATE_FIELD_TYPES, TEMPLATE_KINDS, TEMPLATE_PREFILL_SOURCES } from '../permit-template-library';

export const PERMIT_TEMPLATE_STATUSES = ['draft', 'published'] as const;

export class TemplateFieldDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  label!: string;

  @IsIn([...TEMPLATE_FIELD_TYPES])
  type!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  help?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  options?: string[];

  @IsOptional()
  @IsIn([...TEMPLATE_PREFILL_SOURCES])
  prefill?: string;
}

export class TemplateSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  fields!: TemplateFieldDto[];
}

export class TemplateConfigDto {
  @IsIn([...TEMPLATE_KINDS])
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  declaration?: string;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionDto)
  sections!: TemplateSectionDto[];
}

export class CreatePermitTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  permitTypeIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TemplateConfigDto)
  config?: TemplateConfigDto;
}

export class UpdatePermitTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn([...PERMIT_TEMPLATE_STATUSES])
  status?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  permitTypeIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TemplateConfigDto)
  config?: TemplateConfigDto;
}
