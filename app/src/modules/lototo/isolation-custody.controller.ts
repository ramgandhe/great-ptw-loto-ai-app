import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  AcceptHandoverDto,
  FinishIsolationTestDto,
  MarkLongTermDto,
  RecordWalkDto,
  StartIsolationTestDto,
} from './dto/isolation-custody.dto';
import { IsolationCustodyService } from './isolation-custody.service';
import { LOTOTO_LIBRARY_READ_ROLES, LOTOTO_WRITE_ROLES } from './lototo.constants';

@Controller('lototo')
export class IsolationCustodyController {
  constructor(private readonly custodyService: IsolationCustodyService) {}

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get('certificates/:id/custody')
  getCustody(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.custodyService.getCustody(id, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('certificates/:id/tests')
  startTest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartIsolationTestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.custodyService.startTest(id, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('certificates/:id/tests/:testId/finish')
  finishTest(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('testId', ParseUUIDPipe) testId: string,
    @Body() dto: FinishIsolationTestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.custodyService.finishTest(id, testId, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('certificates/:id/handover')
  acceptHandover(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptHandoverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.custodyService.acceptHandover(id, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('certificates/:id/long-term')
  markLongTerm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkLongTermDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.custodyService.markLongTerm(id, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('certificates/:id/walks')
  recordWalk(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordWalkDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.custodyService.recordWalk(id, dto, user);
  }
}
