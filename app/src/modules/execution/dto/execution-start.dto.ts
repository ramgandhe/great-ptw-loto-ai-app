import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsString, IsUUID, ValidateNested } from 'class-validator';

export class GasReadingDto {
  @IsUUID()
  gasTestingCatalogueId!: string;

  @IsNumber()
  value!: number;
}

export class ExecutionStartDto {
  @IsBoolean()
  toolboxTalk!: boolean;

  @IsArray()
  @IsString({ each: true })
  hazardControls!: string[];

  @IsArray()
  @IsString({ each: true })
  ppeIds!: string[];

  @IsBoolean()
  lototoVerified!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GasReadingDto)
  gasReadings!: GasReadingDto[];
}
