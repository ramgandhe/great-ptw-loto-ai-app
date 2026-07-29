import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PermitRelationsDto } from './permit-relations.dto';

export class CreatePermitDto extends PermitRelationsDto {
  @IsUUID()
  permitTypeId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

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
}
