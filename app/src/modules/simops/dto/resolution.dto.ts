import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  SIMOPS_ASSESSMENT_STATUSES,
  SIMOPS_CONFLICT_SEVERITIES,
  SIMOPS_MITIGATION_STATUSES,
} from '../../../database/schema/simops';

export class AssessConflictDto {
  @IsIn([...SIMOPS_CONFLICT_SEVERITIES])
  assessedSeverity!: (typeof SIMOPS_CONFLICT_SEVERITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  riskSummary?: string;

  @IsOptional()
  findings?: Record<string, unknown>;

  @IsOptional()
  @IsIn([...SIMOPS_ASSESSMENT_STATUSES])
  status?: (typeof SIMOPS_ASSESSMENT_STATUSES)[number];
}

export class MitigationMeasureDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  action!: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  completed?: boolean;
}

export class MitigationPlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MitigationMeasureDto)
  measures!: MitigationMeasureDto[];

  @IsOptional()
  @IsUUID()
  assessmentId?: string;

  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsIn([...SIMOPS_MITIGATION_STATUSES])
  status?: (typeof SIMOPS_MITIGATION_STATUSES)[number];
}

export class ApproveConflictDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  comments!: string;

  @IsOptional()
  @IsUUID()
  mitigationPlanId?: string;
}

export class RejectConflictDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  comments!: string;
}
