import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SaveDraftDto } from './dto/save-draft.dto';
import { PermitDetail, PermitService } from './permit.service';

@Injectable()
export class DraftService {
  constructor(private readonly permitService: PermitService) {}

  saveDraft(
    id: string,
    dto: SaveDraftDto,
    user: AuthenticatedUser,
  ): Promise<PermitDetail> {
    return this.permitService.update(id, dto, user);
  }
}
