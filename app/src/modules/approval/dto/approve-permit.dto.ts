import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { StageAnswersDto } from '../../permit/dto/save-draft.dto';
import { ApprovalCommentDto } from './approval-comment.dto';

export class ApprovePermitDto extends ApprovalCommentDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => StageAnswersDto)
  stageAnswers?: StageAnswersDto;
}
