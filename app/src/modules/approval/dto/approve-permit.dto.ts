import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { StageAnswersDto } from '../../permit/dto/save-draft.dto';
import { ApprovalCommentDto } from './approval-comment.dto';

export class ApprovePermitDto extends ApprovalCommentDto {
  /** Required when another live permit is on a parent or child of this work location. */
  @IsOptional()
  @IsBoolean()
  acknowledgeLocationWarning?: boolean;

  /** Typed name recorded as the approver signature. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  signedName?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => StageAnswersDto)
  stageAnswers?: StageAnswersDto;
}
