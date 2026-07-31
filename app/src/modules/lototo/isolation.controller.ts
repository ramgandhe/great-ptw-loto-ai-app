import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AddIsolationPointDto } from './dto/add-isolation-point.dto';
import { ConfigureSequenceDto } from './dto/configure-sequence.dto';
import { IsolationService } from './isolation.service';
import { LOTOTO_WRITE_ROLES } from './lototo.constants';
import { SequenceService } from './sequence.service';

@Controller('lototo/plans')
export class IsolationController {
  constructor(
    private readonly isolationService: IsolationService,
    private readonly sequenceService: SequenceService,
  ) {}

  @Roles(...LOTOTO_WRITE_ROLES)
  @Post(':id/isolation-points')
  addIsolationPoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIsolationPointDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.isolationService.addIsolationPoint(id, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES)
  @Post(':id/sequence')
  configureSequence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfigureSequenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sequenceService.configureSequence(id, dto, user);
  }
}
