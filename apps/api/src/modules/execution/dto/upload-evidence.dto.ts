import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadEvidenceDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsUUID()
  progressId?: string;
}
