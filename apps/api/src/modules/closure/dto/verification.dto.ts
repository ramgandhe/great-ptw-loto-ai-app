import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

export class VerificationChecklistDto {
  @IsBoolean()
  workCompleted!: boolean;

  @IsBoolean()
  evidenceReviewed!: boolean;

  @IsBoolean()
  areaSecured!: boolean;

  @IsBoolean()
  hazardsRemoved!: boolean;
}

export class VerificationDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @ValidateNested()
  @Type(() => VerificationChecklistDto)
  checklist!: VerificationChecklistDto;
}
