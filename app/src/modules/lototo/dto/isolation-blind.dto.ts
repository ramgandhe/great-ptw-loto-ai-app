import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  BLIND_TYPES,
  BlindType,
} from '../../../database/schema/isolation-blinds';

export class CreateBlindDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  blindTagNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  lineTagNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  pidReference?: string;

  @IsOptional()
  @IsIn([...BLIND_TYPES])
  blindType?: BlindType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  flangeRating?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  blindSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  materialThickness?: string;

  @IsOptional()
  @IsUUID()
  pointId?: string;
}

export class RecordBlindInstallDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  installedTorqueNm?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordBlindRemovalDto {
  @IsOptional()
  @IsBoolean()
  gasketReplaced?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
