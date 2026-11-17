import { IsBoolean, IsDateString, IsIn, IsOptional } from 'class-validator';

export class RenewPermitDto {
  @IsOptional()
  @IsDateString()
  plannedStartAt?: string;

  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;

  /**
   * Slice H6: renewal trigger.
   * - expired (default): prior status must be expired
   * - max_validity: active/suspended/expired at or beyond tenant max
   * - material_change: issuer declares material change; copies predecessor link
   */
  @IsOptional()
  @IsIn(['expired', 'max_validity', 'material_change'])
  reason?: 'expired' | 'max_validity' | 'material_change';

  @IsOptional()
  @IsBoolean()
  materialChange?: boolean;
}
