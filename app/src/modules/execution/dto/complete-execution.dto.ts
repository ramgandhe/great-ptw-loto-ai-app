import { Type } from 'class-transformer';
import { IsBoolean, IsString, MinLength, ValidateNested } from 'class-validator';

export class ExecutionCompletionChecklistDto {
  @IsBoolean()
  workDescribedComplete!: boolean;

  @IsBoolean()
  procedureFollowed!: boolean;

  @IsBoolean()
  lototoDone!: boolean;

  @IsBoolean()
  gasTestingDone!: boolean;
}

export class CompleteExecutionDto {
  @IsString()
  @MinLength(1)
  comment!: string;

  @ValidateNested()
  @Type(() => ExecutionCompletionChecklistDto)
  checklist!: ExecutionCompletionChecklistDto;
}

export class SendBackDto {
  @IsString()
  @MinLength(1)
  comment!: string;
}
