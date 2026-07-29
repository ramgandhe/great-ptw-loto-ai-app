import {
  Equals,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActivatePermitDto {
  @IsBoolean()
  @Equals(true)
  readinessConfirmed!: boolean;
}

export class ProgressUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  summary!: string;
}

export class SuspendPermitDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ResumePermitDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class UploadEvidenceDto {
  @IsOptional()
  @IsUUID()
  progressId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
