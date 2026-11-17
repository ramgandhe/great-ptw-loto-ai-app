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
  /**
   * Legacy field. Must match today's operational date in the org timezone
   * when provided; server always binds reopen to today (Slice C1).
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  operationalDate?: string;

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

/** Today-bound reopen (preferred over legacy /revalidate). */
export class ReopenPermitDto {
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

/** Day-scoped emergency override of the reopen hard gate (Slice D). */
export class MdpOverrideDto {
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

export class RequestOvertimeDto {
  @IsISO8601()
  requestedUntil!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  justification!: string;
}

export class DecideOvertimeDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;
}
