import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateGasTestingDto {
  @IsOptional()
  @IsUUID()
  workstationId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  parameter?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minimum?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maximum?: number;
}
