import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { REJECTION_REASON_CODES } from '../../../database/schema';
import { TEXT_MESSAGE, TEXT_REGEX } from '../../../common/validation';

export class RejectPermitDto {
  @IsString()
  @IsNotEmpty()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('comment') })
  comment!: string;

  @IsOptional()
  @IsIn(REJECTION_REASON_CODES)
  reasonCode?: (typeof REJECTION_REASON_CODES)[number];
}
