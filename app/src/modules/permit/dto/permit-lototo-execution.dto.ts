import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class LototoPointRefDto {
  @IsOptional()
  @IsUUID()
  basePointId?: string;

  @IsOptional()
  @IsUUID()
  extraPointId?: string;
}

export class RecordLototoCrewActionDto extends LototoPointRefDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  lockTagId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reading?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class RecordLototoPointVerificationDto extends LototoPointRefDto {
  @IsIn(['pass', 'fail'])
  result!: 'pass' | 'fail';

  @IsBoolean()
  @Type(() => Boolean)
  tryOutCompleted!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reading?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class RecordLototoDuringCheckDto {
  @IsBoolean()
  @Type(() => Boolean)
  locksRemain!: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class TickLototoSequenceStepDto {
  @IsUUID()
  sequenceStepId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ConfirmLototoPhaseDto {
  @IsIn(['apply', 'remove'])
  phase!: 'apply' | 'remove';

  @IsIn(['pass', 'fail'])
  result!: 'pass' | 'fail';

  @IsBoolean()
  @Type(() => Boolean)
  @Transform(({ value }) => value === true || value === 'true')
  tryOutCompleted!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lockTagId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reading?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsString()
  @MaxLength(255)
  signedName!: string;
}

export class RestartLototoVerificationDto {
  @IsIn(['apply', 'remove'])
  phase!: 'apply' | 'remove';
}

export class RecordLototoRestoreVerificationDto extends LototoPointRefDto {
  @IsIn(['pass', 'fail'])
  result!: 'pass' | 'fail';

  @IsOptional()
  @IsString()
  comment?: string;
}
