import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ConflictDetectionService } from './conflict-detection.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { AlertSearchDto, ConflictAnalysisDto, ConflictSearchDto } from './dto/conflict.dto';
import {
  ApproveConflictDto,
  AssessConflictDto,
  MitigationPlanDto,
  RejectConflictDto,
} from './dto/resolution.dto';
import {
  SIMOPS_ACTION_ROLES,
  SIMOPS_READ_ROLES,
  SIMOPS_RESOLVE_ROLES,
} from './simops.constants';

@Controller('simops')
export class SimopsController {
  constructor(
    private readonly conflictDetectionService: ConflictDetectionService,
    private readonly conflictResolutionService: ConflictResolutionService,
  ) {}

  @Roles(...SIMOPS_READ_ROLES)
  @Get('conflicts')
  listConflicts(@CurrentUser() user: AuthenticatedUser, @Query() query: ConflictSearchDto) {
    return this.conflictDetectionService.listConflicts(user, query);
  }

  @Roles(...SIMOPS_READ_ROLES)
  @Get('history')
  listHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.conflictResolutionService.listHistory(user);
  }

  @Roles(...SIMOPS_READ_ROLES)
  @Get('history/:id')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conflictResolutionService.getHistory(id, user);
  }

  @Roles(...SIMOPS_READ_ROLES)
  @Get('conflicts/:id')
  getConflict(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conflictDetectionService.getConflict(id, user);
  }

  @Roles(...SIMOPS_RESOLVE_ROLES)
  @Post('conflicts/:id/assess')
  assess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssessConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conflictResolutionService.assess(id, dto, user);
  }

  @Roles(...SIMOPS_RESOLVE_ROLES)
  @Post('conflicts/:id/mitigation')
  createMitigation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MitigationPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conflictResolutionService.createMitigation(id, dto, user);
  }

  @Roles(...SIMOPS_RESOLVE_ROLES)
  @Post('conflicts/:id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conflictResolutionService.approve(id, dto, user);
  }

  @Roles(...SIMOPS_RESOLVE_ROLES)
  @Post('conflicts/:id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectConflictDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conflictResolutionService.reject(id, dto, user);
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
