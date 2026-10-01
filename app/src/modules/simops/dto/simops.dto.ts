import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CONFLICT_SEVERITIES,
  CONFLICT_STATUSES,
  SIMOPS_CASE_STATUSES,
  SIMOPS_PERMIT_DECISIONS,
} from '../../../database/schema';

export class ConflictSearchDto {
  @IsOptional()
  @IsIn([...CONFLICT_STATUSES, ...SIMOPS_CASE_STATUSES])
  status?: (typeof CONFLICT_STATUSES)[number] | (typeof SIMOPS_CASE_STATUSES)[number];

  @IsOptional()
  @IsIn([...CONFLICT_SEVERITIES])
  severity?: (typeof CONFLICT_SEVERITIES)[number];

  @IsOptional()
  @IsUUID()
  permitId?: string;
}

export class AnalyseConflictsDto {
  @IsOptional()
  @IsUUID()
  permitId?: string;
}

export class AssessConflictDto {
  @IsIn([...CONFLICT_SEVERITIES])
  assessedSeverity!: (typeof CONFLICT_SEVERITIES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  riskSummary!: string;
}

export class MitigationActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}

export class MitigationPlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  planSummary!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MitigationActionDto)
  actions!: MitigationActionDto[];
}

export class ApproveConflictDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  comments!: string;
}

export class RejectConflictDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  reason!: string;
}

export class SimopsCaseControlDto {
  @IsUUID()
  permitId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  controlText!: string;

  @IsUUID()
  responsibleUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;
}

export class SimopsCaseDecisionDto {
  @IsUUID()
  permitId!: string;

  @IsIn([...SIMOPS_PERMIT_DECISIONS])
  decision!: (typeof SIMOPS_PERMIT_DECISIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comments?: string;
}

export class ResolveSimopsCaseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimopsCaseDecisionDto)
  decisions!: SimopsCaseDecisionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimopsCaseControlDto)
  controls?: SimopsCaseControlDto[];
}
