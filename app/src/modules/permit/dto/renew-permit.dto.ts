import { IsDateString, IsOptional } from 'class-validator';

export class RenewPermitDto {
  @IsOptional()
  @IsDateString()
  plannedStartAt?: string;

  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;
}
