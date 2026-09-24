import { Type } from 'class-transformer';
import { IsNumber, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGasTestingDto {
  @IsUUID()
  workstationId!: string;

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
