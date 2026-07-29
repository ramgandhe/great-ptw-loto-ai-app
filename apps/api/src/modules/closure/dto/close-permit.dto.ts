import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ClosePermitDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsDateString()
  actualEndAt?: string;
}
