import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { REJECTION_REASON_CODES } from '../../../database/schema';

export class RejectPermitDto {
  @IsString()
  @IsNotEmpty()
  comment!: string;

  /** FR-PTW-024 — structured rejection reason code. */
  @IsIn([...REJECTION_REASON_CODES])
  reasonCode!: (typeof REJECTION_REASON_CODES)[number];
}
