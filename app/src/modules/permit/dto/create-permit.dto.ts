import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  NAME_MESSAGE,
  NAME_REGEX,
  PHONE_MESSAGE,
  PHONE_REGEX,
  TEXT_MESSAGE,
  TEXT_REGEX,
} from '../../../common/validation';
import { PermitRelationsDto } from './permit-relations.dto';

export class CreatePermitDto extends PermitRelationsDto {
  @IsUUID()
  permitTypeId!: string;

  @IsString()
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('title') })
  title!: string;

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('workScope') })
  workScope?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('siteNotes') })
  siteNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  emergencyPhone?: string;

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
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  workLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  exactSpot?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  assetIds?: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  plannedStartAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  plannedEndAt?: Date;

  /**
   * Read-only classification on the server. If sent, must match date-derived multi-day;
   * cannot be false while the schedule spans multiple operational days.
   */
  @IsOptional()
  @IsBoolean()
  isMultiDay?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentStep?: number;

  @IsOptional()
  @IsObject()
  formSnapshot?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  receiverSiteVisited?: boolean;

  @IsOptional()
  @IsBoolean()
  executorSiteVisited?: boolean;

  @IsOptional()
  @IsBoolean()
  safetyOfficerSiteVisited?: boolean;
}
