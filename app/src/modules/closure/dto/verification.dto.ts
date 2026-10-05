import { Type } from 'class-transformer';
import { IsBoolean, IsString, MinLength, ValidateNested, IsOptional } from 'class-validator';
import { StageAnswersDto } from '../../permit/dto/save-draft.dto';

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

  @IsOptional()
  @ValidateNested()
  @Type(() => StageAnswersDto)
  stageAnswers?: StageAnswersDto;
}
