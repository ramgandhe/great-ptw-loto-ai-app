import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSubscriptionDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsIn(['trial', 'active'])
  status?: 'trial' | 'active';
}

export class PlanChangeDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UsageRecordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  metricKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  periodLabel!: string;
}

export class ListInvoicesQueryDto {
  @IsOptional()
  @IsIn(['draft', 'issued', 'paid', 'void'])
  status?: 'draft' | 'issued' | 'paid' | 'void';
}
