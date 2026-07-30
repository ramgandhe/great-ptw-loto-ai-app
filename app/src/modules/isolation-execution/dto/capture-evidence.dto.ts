import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Evidence metadata (FR-LTO-009). The binary object is uploaded to MinIO by the
 * infrastructure layer (INF-SP-03.02); this records the immutable metadata and
 * storage reference against the execution.
 */
export class CaptureEvidenceDto {
  @IsOptional()
  @IsUUID()
  isolationPointId?: string;

  @IsOptional()
  @IsUUID()
  verificationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  contentType!: string;

  @IsInt()
  @IsPositive()
  fileSize!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  storageKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string;
}
