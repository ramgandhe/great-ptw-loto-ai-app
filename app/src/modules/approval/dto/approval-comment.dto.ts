import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { TEXT_MESSAGE, TEXT_REGEX } from '../../../common/validation';

export class ApprovalCommentDto {
  @IsOptional()
  @IsString()
  @Matches(TEXT_REGEX, { message: TEXT_MESSAGE('comment') })
  comment?: string;

  @IsOptional()
  @IsBoolean()
  siteVisited?: boolean;
}
