import { IsIn, IsOptional, IsUUID } from 'class-validator';
import {
  SIMOPS_CONFLICT_SEVERITIES,
  SIMOPS_CONFLICT_STATUSES,
} from '../../../database/schema/simops';

export class ConflictSearchDto {
  @IsOptional()
  @IsIn([...SIMOPS_CONFLICT_STATUSES])
  status?: (typeof SIMOPS_CONFLICT_STATUSES)[number];

  @IsOptional()
  @IsIn([...SIMOPS_CONFLICT_SEVERITIES])
  severity?: (typeof SIMOPS_CONFLICT_SEVERITIES)[number];

  @IsOptional()
  @IsUUID()
  permitId?: string;
}

export class ConflictAnalysisDto {
  @IsOptional()
  @IsUUID()
  permitId?: string;
}

export class AlertSearchDto {
  @IsOptional()
  @IsIn(['pending', 'sent', 'failed', 'acknowledged'])
  deliveryStatus?: 'pending' | 'sent' | 'failed' | 'acknowledged';
}
