import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { HistoryService } from './history.service';
import { RESTORATION_READ_ROLES } from './restoration.constants';

@Controller()
export class LototoHistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Roles(...RESTORATION_READ_ROLES)
  @Get('isolation-executions/:id/history')
  forExecution(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.historyService.listForExecution(id, user);
  }

  @Roles(...RESTORATION_READ_ROLES)
  @Get('lototo-plans/:planId/history')
  forPlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.historyService.listForPlan(planId, user);
  }
}
