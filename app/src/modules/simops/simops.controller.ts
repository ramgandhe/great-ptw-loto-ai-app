import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ConflictDetectionService } from './conflict-detection.service';
import { AlertSearchDto, ConflictAnalysisDto, ConflictSearchDto } from './dto/conflict.dto';
import { SIMOPS_ACTION_ROLES, SIMOPS_READ_ROLES } from './simops.constants';

@Controller('simops')
export class SimopsController {
  constructor(private readonly conflictDetectionService: ConflictDetectionService) {}

  @Roles(...SIMOPS_READ_ROLES)
  @Get('conflicts')
  listConflicts(@CurrentUser() user: AuthenticatedUser, @Query() query: ConflictSearchDto) {
    return this.conflictDetectionService.listConflicts(user, query);
  }

  @Roles(...SIMOPS_READ_ROLES)
  @Get('conflicts/:id')
  getConflict(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conflictDetectionService.getConflict(id, user);
  }

  @Roles(...SIMOPS_ACTION_ROLES)
  @Post('analyse')
  analyse(@Body() dto: ConflictAnalysisDto, @CurrentUser() user: AuthenticatedUser) {
    return this.conflictDetectionService.analyse(user, dto);
  }

  @Roles(...SIMOPS_READ_ROLES)
  @Get('alerts')
  listAlerts(@CurrentUser() user: AuthenticatedUser, @Query() query: AlertSearchDto) {
    return this.conflictDetectionService.listAlerts(user, query);
  }
}
