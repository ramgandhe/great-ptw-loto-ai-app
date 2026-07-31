import { IsString, MaxLength, MinLength } from 'class-validator';

export class EvidenceUploadUrlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  contentType!: string;
}
