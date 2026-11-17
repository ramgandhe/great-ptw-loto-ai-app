import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Setup wizard state; step keys are defined by the frontend wizard. */
export class OrganisationSetupProgressDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  skipped?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastStep?: string;
}

export class CreateOrganisationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;
}

export class UpdateOrganisationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  /** Max multi-day permit validity in operational days from planned start (default 7). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  maxMultiDayValidityDays?: number;

  /** Operational-day cut-off HH:mm in organisation timezone (default 16:30). */
  @IsOptional()
  @IsString()
  @Matches(/^([01]?\d|2[0-3]):([0-5]\d)$/, {
    message: 'operationalDayCutoff must be HH:mm (24-hour)',
  })
  operationalDayCutoff?: string;

  /** Who may approve same-day overtime. */
  @IsOptional()
  @IsIn(['permit-approver', 'area-authority', 'shift-in-charge'])
  overtimeApproverRole?: 'permit-approver' | 'area-authority' | 'shift-in-charge';

  @IsOptional()
  @ValidateNested()
  @Type(() => OrganisationSetupProgressDto)
  setupProgress?: OrganisationSetupProgressDto;
}
