import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class DecideHazardRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  risks!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  consequences?: string[];

  @IsArray()
  @IsString({ each: true })
  controls!: string[];

  @IsArray()
  @IsString({ each: true })
  permitTypeCodes!: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  workLocationIds!: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  assetIds!: string[];
}
