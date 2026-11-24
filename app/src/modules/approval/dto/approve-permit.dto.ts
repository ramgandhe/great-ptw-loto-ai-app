import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { NAME_MESSAGE, NAME_REGEX } from '../../../common/validation';
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
  @Matches(NAME_REGEX, { message: NAME_MESSAGE('signedName') })
  signedName?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => StageAnswersDto)
  stageAnswers?: StageAnswersDto;

  /**
   * Multi-day only (final approval). Default true = hard daily reopen gate.
   * Ignored when the permit is not multi-day.
   */
  @IsOptional()
  @IsBoolean()
  dailyRevalidationRequired?: boolean;

  /**
   * Multi-day only (final approval). Default true = day-scoped override allowed.
   * Ignored when the permit is not multi-day.
   */
  @IsOptional()
  @IsBoolean()
  emergencyOverrideAllowed?: boolean;
}
