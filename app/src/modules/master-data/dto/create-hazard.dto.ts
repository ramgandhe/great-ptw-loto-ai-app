import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { HAZARD_SEVERITIES } from '../master-data.constants';

export class CreateHazardDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn([...HAZARD_SEVERITIES])
  severity?: (typeof HAZARD_SEVERITIES)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
