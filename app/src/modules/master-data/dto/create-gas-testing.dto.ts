import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGasTestingDto {
  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @IsOptional()
  @IsUUID()
  workLocationId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  parameter!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  unit!: string;

  @Type(() => Number)
  @IsNumber()
  minimum!: number;

  @Type(() => Number)
  @IsNumber()
  maximum!: number;
}
