import { Type } from 'class-transformer';
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
  @IsString()
  @MaxLength(64)
  lockTagId!: string;

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

export class RecordLototoRestoreVerificationDto extends LototoPointRefDto {
  @IsIn(['pass', 'fail'])
  result!: 'pass' | 'fail';

  @IsOptional()
  @IsString()
  comment?: string;
}
