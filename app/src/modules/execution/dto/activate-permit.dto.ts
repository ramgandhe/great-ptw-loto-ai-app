import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ActivatePermitDto {
  @IsOptional()
  @IsDateString()
  actualStartAt?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
