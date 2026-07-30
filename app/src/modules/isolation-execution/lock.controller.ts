import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApplyLockDto } from './dto/apply-lock.dto';
import { LockService } from './lock.service';
import { ISOLATION_ACTION_ROLES, ISOLATION_READ_ROLES } from './isolation-execution.constants';

@Controller()
export class LockController {
  constructor(private readonly lockService: LockService) {}

  @Roles(...ISOLATION_ACTION_ROLES)
  @Post('isolation-executions/:executionId/locks')
  apply(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Body() dto: ApplyLockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockService.apply(executionId, dto, user);
  }

  @Roles(...ISOLATION_READ_ROLES)
  @Get('isolation-executions/:executionId/locks')
  list(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockService.list(executionId, user);
  }

  @Roles(...ISOLATION_ACTION_ROLES)
  @Post('locks/:lockId/remove')
  remove(
    @Param('lockId', ParseUUIDPipe) lockId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockService.remove(lockId, user);
  }
}
