import { IsString, MaxLength, MinLength } from 'class-validator';

export class EvidenceDownloadUrlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  storageKey!: string;
}
