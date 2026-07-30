import { IsOptional, IsString } from 'class-validator';

export class ApprovalCommentDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
