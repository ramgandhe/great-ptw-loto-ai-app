import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

export class ClosureChecklistDto {
  @IsBoolean()
  workCompleted!: boolean;

  @IsBoolean()
  evidenceReviewed!: boolean;

  @IsBoolean()
  areaSecured!: boolean;

  @IsBoolean()
  hazardsRemoved!: boolean;
}

export class ClosePermitDto {
  @IsString()
  @MinLength(1)
  comment!: string;

  @IsOptional()
  @IsDateString()
  actualEndAt?: string;

  @ValidateNested()
  @Type(() => ClosureChecklistDto)
  checklist!: ClosureChecklistDto;
}
