import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { REJECTION_REASON_CODES } from '../../../database/schema';

export class RejectPermitDto {
  @IsString()
  @IsNotEmpty()
  comment!: string;

  @IsOptional()
  @IsIn(REJECTION_REASON_CODES)
  reasonCode?: (typeof REJECTION_REASON_CODES)[number];
}
