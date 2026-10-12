import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ApprovalCommentDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  siteVisited?: boolean;
}
