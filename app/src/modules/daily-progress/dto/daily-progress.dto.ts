import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RecordDailyProgressDto {
  @IsDateString()
  operationalDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  completedWork!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  pendingWork?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  summary!: string;

  @IsOptional()
  @IsBoolean()
  submit?: boolean;

  @IsOptional()
  @IsObject()
  attachmentMeta?: Record<string, unknown>;
}

export class CreateShiftHandoverDto {
  @IsUUID()
  incomingUserId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  completedActivities!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  outstandingWork!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  safetyObservations?: string;

  @IsOptional()
  @IsUUID()
  dailyProgressId?: string;
}
