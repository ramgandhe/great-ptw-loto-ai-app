import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLockboxDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  boxNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  masterLockSerial!: string;

  @IsOptional()
  @IsString()
  locationDescription?: string;
}

export class ApplyPersonalLockDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  personalLockNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  workerName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @IsOptional()
  @IsUUID()
  permitId?: string;

  @IsOptional()
  @IsUUID()
  workforceUserId?: string;
}

export class SealLockboxDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReleaseLockboxDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RemoveAbsentLockDto {
  @IsString()
  @MinLength(1)
  contactAttempts!: string;

  @IsBoolean()
  clearOfPlantConfirmed!: boolean;

  @IsUUID()
  authoriserOneId!: string;

  @IsUUID()
  authoriserTwoId!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
