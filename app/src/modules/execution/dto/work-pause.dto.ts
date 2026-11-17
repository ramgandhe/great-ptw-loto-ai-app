import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class WorkPauseChecklistDto {
  @IsBoolean()
  personnelCleared!: boolean;

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

export class PauseWorkDto {
  @IsString()
  @MinLength(1)
  summary!: string;

  @ValidateNested()
  @Type(() => WorkPauseChecklistDto)
  checklist!: WorkPauseChecklistDto;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Point / lock ids removed overnight (exception). Forces re-isolate on resume. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  lototoRemovals?: string[];

  /**
   * When org overnightIsolationPolicy is restore_allowed: choose restore overnight.
   * Ignored (and rejected if true) when policy is hold.
   */
  @IsOptional()
  @IsBoolean()
  overnightRestoreChosen?: boolean;

  /** Required when prior operational days were left in progress without a pause. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  lateReason?: string;

  @IsOptional()
  @IsObject()
  lototoSnapshot?: Record<string, unknown>;
}
