import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DraftService } from './draft.service';
import { SaveDraftDto } from './dto/save-draft.dto';
import { PERMIT_WRITE_ROLES } from './permit.constants';

@Controller('permits')
export class DraftController {
  constructor(private readonly draftService: DraftService) {}

  @Roles(...PERMIT_WRITE_ROLES)
  @Patch(':id')
  updateDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.draftService.saveDraft(id, dto, user);
  }
}
