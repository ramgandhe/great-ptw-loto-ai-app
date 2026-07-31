import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  ACTION_STATUSES,
  INCIDENT_PRIORITIES,
  ROOT_CAUSE_METHODOLOGIES,
} from '../../../database/schema';

export class AssignInvestigationDto {
  @IsUUID()
  investigatorId!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn(INCIDENT_PRIORITIES)
  priority?: (typeof INCIDENT_PRIORITIES)[number];
}

export class RootCauseAnalysisDto {
  @IsOptional()
  @IsIn(ROOT_CAUSE_METHODOLOGIES)
  methodology?: (typeof ROOT_CAUSE_METHODOLOGIES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  findings?: string;
}

export class CorrectiveActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsUUID()
  ownerId!: string;

  @IsDateString()
  dueDate!: string;
}

export class PreventiveActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateCorrectiveActionDto {
  @IsOptional()
  @IsIn(ACTION_STATUSES)
  status?: (typeof ACTION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
