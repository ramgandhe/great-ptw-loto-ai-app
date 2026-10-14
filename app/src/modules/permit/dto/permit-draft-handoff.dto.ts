import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { DRAFT_HOLDERS } from '../permit-draft-handoff';

const REVISION_MESSAGE = 'expectedRevision is required: reload the permit, or update the app to keep saving';

export class PermitDraftHandoffDto {
  @IsIn([...DRAFT_HOLDERS])
  to!: (typeof DRAFT_HOLDERS)[number];

  @IsInt({ message: REVISION_MESSAGE })
  @Min(0, { message: REVISION_MESSAGE })
  expectedRevision!: number;
}

export class PermitDraftReturnDto {
  @IsInt({ message: REVISION_MESSAGE })
  @Min(0, { message: REVISION_MESSAGE })
  expectedRevision!: number;

  @IsString()
  @MinLength(1, { message: 'Why return is required' })
  @MaxLength(1000)
  reason!: string;
}
