import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ResumeWorkCrewMemberDto {
  @IsUUID()
  workforceUserId!: string;

  @IsIn(['primary', 'substitute'])
  role!: 'primary' | 'substitute';

  @IsOptional()
  @IsUUID()
  substituteForUserId?: string;
}

export class ResumeWorkDto {
  /** Checklist answers keyed by template item key (booleans). */
  @IsObject()
  checklist!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Today's roster. Required only on the first resume of a new day when the org requires daily crew. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResumeWorkCrewMemberDto)
  crew?: ResumeWorkCrewMemberDto[];
}
