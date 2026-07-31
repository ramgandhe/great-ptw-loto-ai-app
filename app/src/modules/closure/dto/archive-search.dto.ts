import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ArchiveSearchDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
