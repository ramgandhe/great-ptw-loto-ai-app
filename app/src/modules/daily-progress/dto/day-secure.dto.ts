import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Checklist answers; full-mode extras are optional in the DTO and enforced by mode. */
export class DaySecureChecklistDto {
  @IsBoolean()
  workAreaLeftSafe!: boolean;

  @IsBoolean()
  materialsToolsSecured!: boolean;

  @IsOptional()
  @IsBoolean()
  isolationsIntact?: boolean;

  @IsOptional()
  @IsBoolean()
  openingsBarricaded?: boolean;

  @IsOptional()
  @IsBoolean()
  emergencyAccessClear?: boolean;

  @IsOptional()
  @IsBoolean()
  overnightHazardsNoted?: boolean;
}

export class CreateDaySecureDto {
  @IsDateString()
  operationalDate!: string;

  /** Must be true — personnel accounted for / clear of the work area. */
  @IsBoolean()
  personnelCleared!: boolean;

  @ValidateNested()
  @Type(() => DaySecureChecklistDto)
  checklist!: DaySecureChecklistDto;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  /**
   * Required when securing a prior operational day (late secure).
   * Server also derives late from operationalDate vs current org day.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lateReason?: string;
}

export class CountersignDaySecureDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
