import { Type } from 'class-transformer';
import { IsBoolean, IsString, MinLength, ValidateNested } from 'class-validator';

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
  @IsString()
  @MinLength(1)
  comment!: string;

  @ValidateNested()
  @Type(() => VerificationChecklistDto)
  checklist!: VerificationChecklistDto;
}
