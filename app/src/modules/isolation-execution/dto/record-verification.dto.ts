import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { VERIFICATION_FAIL, VERIFICATION_PASS } from '../isolation-execution.constants';

export class RecordVerificationDto {
  @IsUUID()
  isolationPointId!: string;

  @IsIn([VERIFICATION_PASS, VERIFICATION_FAIL])
  result!: typeof VERIFICATION_PASS | typeof VERIFICATION_FAIL;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  method?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  comment?: string;
}
