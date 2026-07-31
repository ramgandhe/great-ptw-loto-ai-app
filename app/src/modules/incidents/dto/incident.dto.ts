import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  INCIDENT_PRIORITIES,
  INCIDENT_SEVERITY_PATHS,
  INCIDENT_TYPES,
} from '../../../database/schema';

export class CreateIncidentDto {
  @IsIn(INCIDENT_TYPES)
  incidentType!: (typeof INCIDENT_TYPES)[number];

  @IsOptional()
  @IsIn(INCIDENT_SEVERITY_PATHS)
  severityPath?: (typeof INCIDENT_SEVERITY_PATHS)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  locationDescription?: string;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsIn(INCIDENT_PRIORITIES)
  priority?: (typeof INCIDENT_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  plantId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  permitIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  machineryIds?: string[];

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  locationDescription?: string;

  @IsOptional()
  @IsIn(INCIDENT_PRIORITIES)
  priority?: (typeof INCIDENT_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  plantId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  workstationId?: string;
}

export class UploadIncidentEvidenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
