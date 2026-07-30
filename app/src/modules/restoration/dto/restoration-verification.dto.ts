import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RESTORATION_FAIL, RESTORATION_PASS } from '../restoration.constants';

export class RestorationVerificationDto {
  @IsUUID()
  isolationPointId!: string;

  @IsOptional()
  @IsUUID()
  restorationId?: string;

  @IsIn([RESTORATION_PASS, RESTORATION_FAIL])
  result!: typeof RESTORATION_PASS | typeof RESTORATION_FAIL;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
