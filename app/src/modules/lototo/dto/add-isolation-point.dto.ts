import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class EnergySourceDto {
  @IsString()
  @MaxLength(64)
  energySourceType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lockMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tagType?: string;
}

export class AddIsolationPointDto {
  @IsUUID()
  machineryId!: string;

  @IsString()
  @MaxLength(64)
  isolationNumber!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  verificationRequired?: boolean;

  @IsOptional()
  @IsUUID()
  equipmentEnergySourceId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnergySourceDto)
  energySource?: EnergySourceDto;
}
