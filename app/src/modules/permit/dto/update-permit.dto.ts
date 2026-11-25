import { Transform, Type } from 'class-transformer';
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  DATETIME_MESSAGE,
  EMERGENCY_PHONE_MESSAGE,
  EMERGENCY_PHONE_REGEX,
  NAME_MESSAGE,
  NAME_REGEX,
  TEXT_MESSAGE,
  TEXT_REGEX,
  TITLE_MESSAGE,
  TITLE_REGEX,
  transformDateTime,
} from '../../../common/validation';
import {
  PermitExecutorDto,
  PermitHazardDto,
  PermitLototoDto,
  PermitGasTestingDto,
  PermitPpeDto,
  PermitFormResponseDto,
} from './permit-relations.dto';
import { PermitAssigneeDto } from './permit-relations.dto';

export class UpdatePermitDto {
  @IsOptional()
  @IsUUID()
  permitTypeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(TITLE_REGEX, { message: TITLE_MESSAGE('title') })
  title?: string;

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
  @ValidateIf((o) => typeof o.emergencyPhone === 'string' && o.emergencyPhone.trim().length > 0)
  @IsString()
  @MaxLength(32)
  @Matches(EMERGENCY_PHONE_REGEX, { message: EMERGENCY_PHONE_MESSAGE })
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
  @Transform(transformDateTime)
  @IsDate({ message: DATETIME_MESSAGE('plannedStartAt') })
  plannedStartAt?: Date;

  @IsOptional()
  @Transform(transformDateTime)
  @IsDate({ message: DATETIME_MESSAGE('plannedEndAt') })
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitFormResponseDto)
  formResponses?: PermitFormResponseDto[];

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
  @IsBoolean()
  lototoRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitLototoDto)
  lototo?: PermitLototoDto[];

  @IsOptional()
  @IsBoolean()
  gasTestingRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitGasTestingDto)
  gasTesting?: PermitGasTestingDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitExecutorDto)
  executors?: PermitExecutorDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitAssigneeDto)
  viewers?: PermitAssigneeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitAssigneeDto)
  safetyOfficers?: PermitAssigneeDto[];

  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('safetyApprovalComment') })
  safetyApprovalComment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('safetyApprovalSignedName') })
  safetyApprovalSignedName?: string;

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
