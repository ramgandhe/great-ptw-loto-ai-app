import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { REVALIDATION_OUTCOMES } from '../../../database/schema';

export class RevalidatePermitDto {
  @IsString()
  @IsNotEmpty()
  operationalDate!: string;

  @IsIn([...REVALIDATION_OUTCOMES])
  outcome!: (typeof REVALIDATION_OUTCOMES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  findings!: string;

  @IsOptional()
  @IsObject()
  checklist?: Record<string, unknown>;
}

export class SuspendPermitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  reason!: string;
}

export class RequestExtensionDto {
  @IsISO8601()
  requestedEndAt!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  justification!: string;
}

export class DecideExtensionDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;
}
