import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { EXECUTION_ACTION_ROLES, EXECUTION_READ_ROLES } from './execution.constants';
import { ActivatePermitDto } from './dto/activate-permit.dto';
import { SuspendPermitDto } from './dto/suspend-permit.dto';
import { ExecutionService } from './execution.service';

@Controller('permits')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Roles(...EXECUTION_READ_ROLES)
  @Get('active')
  listActive(@CurrentUser() user: AuthenticatedUser) {
    return this.executionService.listActive(user);
  }

  @Roles(...EXECUTION_ACTION_ROLES)
  @Post(':id/activate')
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivatePermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.activate(id, dto, user);
  }

  @Roles(...EXECUTION_ACTION_ROLES)
  @Post(':id/suspend')
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.suspend(id, dto, user);
  }

  @Roles(...EXECUTION_ACTION_ROLES)
  @Post(':id/resume')
  resume(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.executionService.resume(id, user);
  }
}
