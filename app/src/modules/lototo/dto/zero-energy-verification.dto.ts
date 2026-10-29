import {
  IsDateString,
  IsIn,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ZVE_CATEGORIES,
  ZVE_RESULTS,
  ZveCategory,
  ZveResult,
} from '../../../database/schema/zero-energy-verification';

export class RecordZveVerificationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  pointCode!: string;

  @IsIn([...ZVE_CATEGORIES])
  verificationCategory!: ZveCategory;

  @IsOptional()
  @IsIn([...ZVE_RESULTS])
  result?: ZveResult;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  instrumentMakeModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  instrumentSerialNo?: string;

  @IsOptional()
  @IsDateString()
  calibrationExpiryDate?: string;

  @IsObject()
  @IsNotEmptyObject()
  readingsPayload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  photoStorageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  photoChecksum?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
