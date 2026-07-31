import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ConflictResolutionService } from './conflict-resolution.service';
import {
  AnalyseConflictsDto,
  ApproveConflictDto,
  AssessConflictDto,
  ConflictSearchDto,
  MitigationPlanDto,
  RejectConflictDto,
} from './dto/simops.dto';
import { SIMOPS_READ_ROLES, SIMOPS_RESOLVE_ROLES, SIMOPS_WRITE_ROLES } from './simops.constants';
import { SimopsService } from './simops.service';

@Controller('simops')
export class SimopsController {
  constructor(
    private readonly simopsService: SimopsService,
    private readonly resolutionService: ConflictResolutionService,
  ) {}

  @Roles(...SIMOPS_READ_ROLES)
  @Get('conflicts')
  listConflicts(@CurrentUser() user: AuthenticatedUser, @Query() query: ConflictSearchDto) {
    return this.simopsService.listConflicts(user, query);
  }

  @Roles(...SIMOPS_READ_ROLES)
  @Get('history')
  listHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.resolutionService.listHistory(user);
  }

  @Roles(...SIMOPS_READ_ROLES)
  @Get('history/:id')
  getHistoryRecord(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.resolutionService.getHistoryRecord(id, user);
  }

  @Roles(...SIMOPS_READ_ROLES)
  @Get('conflicts/:id')
  findConflict(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.simopsService.findConflict(id, user);
  }

  @Roles(...SIMOPS_WRITE_ROLES)
  @Post('analyse')
  analyse(@Body() dto: AnalyseConflictsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.simopsService.analyse(user, dto.permitId);
  }

  @Roles(...SIMOPS_READ_ROLES)
  @Get('alerts')
  listAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.simopsService.listAlerts(user);
  }

  @Roles(...SIMOPS_RESOLVE_ROLES)
  @Post('conflicts/:id/assess')
  assess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssessConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.resolutionService.assess(id, dto, user);
  }

  @Roles(...SIMOPS_RESOLVE_ROLES)
  @Post('conflicts/:id/mitigation')
  createMitigation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MitigationPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.resolutionService.createMitigation(id, dto, user);
  }

  @Roles(...SIMOPS_RESOLVE_ROLES)
  @Post('conflicts/:id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.resolutionService.approve(id, dto, user);
  }

  @Roles(...SIMOPS_RESOLVE_ROLES)
  @Post('conflicts/:id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.resolutionService.reject(id, dto, user);
  }
}
