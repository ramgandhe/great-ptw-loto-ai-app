import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  DecideExtensionDto,
  DecideOvertimeDto,
  MdpOverrideDto,
  ReopenPermitDto,
  RequestExtensionDto,
  RequestOvertimeDto,
  RevalidatePermitDto,
  SuspendPermitDto,
} from './dto/revalidation.dto';
import {
  EXTENSION_APPROVE_ROLES,
  EXTENSION_REQUEST_ROLES,
  MDP_OVERRIDE_ROLES,
  OVERTIME_APPROVE_ROLES,
  OVERTIME_REQUEST_ROLES,
  REVALIDATION_READ_ROLES,
  REVALIDATION_WRITE_ROLES,
} from './revalidation.constants';
import { MdpOpsService } from './mdp-ops.service';
import { RevalidationService } from './revalidation.service';

@Controller()
export class RevalidationController {
  constructor(
    private readonly revalidationService: RevalidationService,
    private readonly mdpOpsService: MdpOpsService,
  ) {}

  /** Today-bound reopen (timezone-aware operational date). */
  @Roles(...REVALIDATION_WRITE_ROLES)
  @Post('permits/:id/reopen')
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.reopen(id, dto, user);
  }

  /** Slice G: composed reopen checklist (site security / gas / LOTOTO / SIMOPS). */
  @Roles(...REVALIDATION_READ_ROLES)
  @Get('permits/:id/reopen-composition')
  getReopenComposition(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.getReopenComposition(id, user);
  }

  /** Day-scoped emergency override of the reopen hard gate. */
  @Roles(...MDP_OVERRIDE_ROLES)
  @Post('permits/:id/mdp-override')
  useMdpOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MdpOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.useMdpOverride(id, dto, user);
  }

  /** Legacy alias for reopen — still today-bound. */
  @Roles(...REVALIDATION_WRITE_ROLES)
  @Post('permits/:id/revalidate')
  revalidate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevalidatePermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.revalidate(id, dto, user);
  }

  @Roles(...REVALIDATION_WRITE_ROLES)
  @Post('permits/:id/continue')
  continuePermit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.revalidationService.continuePermit(id, user);
  }

  @Roles(...REVALIDATION_WRITE_ROLES)
  @Post('permits/:id/suspend')
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.suspend(id, dto, user);
  }

  @Roles(...EXTENSION_REQUEST_ROLES)
  @Post('permits/:id/extensions')
  requestExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestExtensionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.requestExtension(id, dto, user);
  }

  @Roles(...OVERTIME_REQUEST_ROLES)
  @Post('permits/:id/overtime')
  requestOvertime(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestOvertimeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.requestOvertime(id, dto, user);
  }

  @Roles(...REVALIDATION_READ_ROLES)
  @Get('permits/:id/overtime')
  listOvertime(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.revalidationService.listOvertime(id, user);
  }

  @Roles(...REVALIDATION_READ_ROLES)
  @Get('mdp/pending-time-requests')
  listPendingTimeRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.revalidationService.listPendingTimeRequests(user);
  }

  /** Slice J1: morning queues (secure / late / reopen / overtime / validity). */
  @Roles(...REVALIDATION_READ_ROLES)
  @Get('mdp/morning-queue')
  getMorningQueue(@CurrentUser() user: AuthenticatedUser) {
    return this.mdpOpsService.getMorningQueue(user);
  }

  /** Slice J2: MDP checklist library (seeds into organisation safety checklists). */
  @Roles(...REVALIDATION_READ_ROLES)
  @Get('mdp/checklist-library')
  getChecklistLibrary(@CurrentUser() user: AuthenticatedUser) {
    return this.mdpOpsService.getChecklistLibrary(user);
  }

  /** Slice J6: MDP operational KPIs. */
  @Roles(...REVALIDATION_READ_ROLES)
  @Get('mdp/analytics/kpis')
  getMdpAnalyticsKpis(@CurrentUser() user: AuthenticatedUser) {
    return this.mdpOpsService.getAnalyticsKpis(user);
  }

  @Roles(...REVALIDATION_READ_ROLES)
  @Get('permits/:id/revalidation-history')
  listHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.revalidationService.listHistory(id, user);
  }

  @Roles(...EXTENSION_APPROVE_ROLES)
  @Post('extensions/:id/approve')
  approveExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideExtensionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.approveExtension(id, dto, user);
  }

  @Roles(...EXTENSION_APPROVE_ROLES)
  @Post('extensions/:id/reject')
  rejectExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideExtensionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.rejectExtension(id, dto, user);
  }

  @Roles(...OVERTIME_APPROVE_ROLES)
  @Post('overtime/:id/approve')
  approveOvertime(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideOvertimeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.approveOvertime(id, dto, user);
  }

  @Roles(...OVERTIME_APPROVE_ROLES)
  @Post('overtime/:id/reject')
  rejectOvertime(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideOvertimeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revalidationService.rejectOvertime(id, dto, user);
  }
}
