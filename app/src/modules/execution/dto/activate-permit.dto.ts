import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ExecutionStartDto } from './execution-start.dto';

export class ActivatePermitDto {
  @IsOptional()
  @IsDateString()
  actualStartAt?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExecutionStartDto)
  start?: ExecutionStartDto;
}
