import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class StartIsolationTestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  testReason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  pointIds!: string[];
}

export class FinishIsolationTestDto {
  @IsBoolean()
  zeroEnergyProved!: boolean;
}

export class AcceptHandoverDto {
  @IsBoolean()
  jointInspectionCompleted!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  integrityNotes?: string;

  @IsOptional()
  @IsBoolean()
  activePermitsReviewed?: boolean;
}

export class MarkLongTermDto {
  @IsBoolean()
  isLongTerm!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  ltiReason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ltiAuditIntervalDays?: number;
}

export class RecordWalkDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
