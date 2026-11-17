import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MDP_EVIDENCE_KINDS } from '../../../database/schema/multi-day';

export class UploadMdpEvidenceDto {
  @IsIn([...MDP_EVIDENCE_KINDS])
  kind!: (typeof MDP_EVIDENCE_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  operationalDate?: string;

  @IsOptional()
  @IsUUID()
  dailyProgressId?: string;

  @IsOptional()
  @IsUUID()
  daySecureId?: string;

  @IsOptional()
  @IsUUID()
  revalidationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
