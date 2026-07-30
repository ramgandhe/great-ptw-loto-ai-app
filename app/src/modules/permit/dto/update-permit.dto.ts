import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  PermitExecutorDto,
  PermitHazardDto,
  PermitPpeDto,
} from './permit-relations.dto';

export class UpdatePermitDto {
  @IsOptional()
  @IsUUID()
  permitTypeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  workScope?: string;

  @IsOptional()
  @IsUUID()
  plantId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @IsOptional()
  @IsUUID()
  machineryId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  plannedStartAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  plannedEndAt?: Date;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentStep?: number;

  @IsOptional()
  @IsObject()
  formSnapshot?: Record<string, unknown>;

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
