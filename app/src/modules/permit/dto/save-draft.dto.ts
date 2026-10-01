import { IsInt, Min } from 'class-validator';
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
}
