import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ANALYTICS_SNAPSHOT_SCOPES,
  DASHBOARD_KINDS,
  REPORT_EXPORT_FORMATS,
} from '../../../database/schema/analytics';

export const REPORT_TYPES = [
  'permit_summary',
  'incident_summary',
  'simops_summary',
  'lototo_summary',
  'operational_kpis',
] as const;

export class DashboardFilterDto {
  @IsOptional()
  @IsIn([...DASHBOARD_KINDS])
  kind?: (typeof DASHBOARD_KINDS)[number];
}

export class KPIFilterDto {
  @IsOptional()
  @IsIn([...DASHBOARD_KINDS])
  kind?: (typeof DASHBOARD_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  periodLabel?: string;
}

export class ReportRequestDto {
  @IsIn([...REPORT_TYPES])
  reportType!: (typeof REPORT_TYPES)[number];

  @IsIn([...REPORT_EXPORT_FORMATS])
  format!: (typeof REPORT_EXPORT_FORMATS)[number];

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn([...ANALYTICS_SNAPSHOT_SCOPES])
  scope?: (typeof ANALYTICS_SNAPSHOT_SCOPES)[number];
}

export class AnalyticsTrendsQueryDto {
  @IsOptional()
  @IsIn([...ANALYTICS_SNAPSHOT_SCOPES])
  scope?: (typeof ANALYTICS_SNAPSHOT_SCOPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  limit?: number;
}

export class ListReportsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  status?: string;
}
