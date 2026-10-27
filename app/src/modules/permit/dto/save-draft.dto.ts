import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { PermitFormResponseDto } from './permit-relations.dto';
import { UpdatePermitDto } from './update-permit.dto';

const REVISION_MESSAGE = 'expectedRevision is required: reload the permit, or update the app to keep saving';

export class SaveDraftDto extends UpdatePermitDto {
  @IsInt({ message: REVISION_MESSAGE })
  @Min(0, { message: REVISION_MESSAGE })
  expectedRevision!: number;
}

export class SubmitPermitDto {
  @IsInt({ message: REVISION_MESSAGE })
  @Min(0, { message: REVISION_MESSAGE })
  expectedRevision!: number;

  /** Typed name recorded as the initiator signature. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  signedName?: string;
}

/** Template answers required at approval or closure, recorded with that decision. */
export class StageAnswersDto extends SubmitPermitDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PermitFormResponseDto)
  formResponses!: PermitFormResponseDto[];
}
