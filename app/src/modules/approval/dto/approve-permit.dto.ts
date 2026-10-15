import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { StageAnswersDto } from '../../permit/dto/save-draft.dto';
import { ApprovalCommentDto } from './approval-comment.dto';

export class ApprovePermitDto extends ApprovalCommentDto {
  /** Required when another live permit is on a parent or child of this work location. */
  @IsOptional()
  @IsBoolean()
  acknowledgeLocationWarning?: boolean;
  @IsOptional()
  @ValidateNested()
  @Type(() => StageAnswersDto)
  stageAnswers?: StageAnswersDto;
}
