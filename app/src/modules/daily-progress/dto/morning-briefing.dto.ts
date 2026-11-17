import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RecordToolboxTalkDto {
  @IsDateString()
  operationalDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  topic!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  attendeeUserIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class DailyCrewMemberDto {
  @IsUUID()
  workforceUserId!: string;

  @IsIn(['primary', 'substitute'])
  role!: 'primary' | 'substitute';

  @IsOptional()
  @IsUUID()
  substituteForUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ReplaceDailyCrewDto {
  @IsDateString()
  operationalDate!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DailyCrewMemberDto)
  members!: DailyCrewMemberDto[];
}
