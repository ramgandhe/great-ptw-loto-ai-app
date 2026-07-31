import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CaptureEvidenceDto } from './dto/capture-evidence.dto';
import { EvidenceUploadUrlDto } from './dto/evidence-upload-url.dto';
import { IsolationExecutionService } from './isolation-execution.service';
import { ISOLATION_ACTION_ROLES, ISOLATION_READ_ROLES } from './isolation-execution.constants';

@Controller()
export class IsolationExecutionController {
  constructor(private readonly executionService: IsolationExecutionService) {}

  @Roles(...ISOLATION_ACTION_ROLES)
  @Post('lototo-plans/:planId/isolation-execution')
  start(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.start(planId, user);
  }

  @Roles(...ISOLATION_READ_ROLES)
  @Get('lototo-plans/:planId/isolation-execution')
  getForPlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.getForPlan(planId, user);
  }

  @Roles(...ISOLATION_READ_ROLES)
  @Get('isolation-executions/:id')
  getDetail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.executionService.getDetail(id, user);
  }

  @Roles(...ISOLATION_ACTION_ROLES)
  @Post('isolation-executions/:id/isolate')
  isolate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.executionService.markIsolated(id, user);
  }

  @Roles(...ISOLATION_ACTION_ROLES)
  @Post('isolation-executions/:id/verify')
  verify(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.executionService.markVerified(id, user);
  }

  @Roles(...ISOLATION_ACTION_ROLES)
  @Post('isolation-executions/:id/evidence')
  captureEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CaptureEvidenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.captureEvidence(id, dto, user);
  }

  @Roles(...ISOLATION_ACTION_ROLES)
  @Post('isolation-executions/:id/evidence/upload-url')
  evidenceUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvidenceUploadUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.evidenceUploadUrl(id, dto, user);
  }

  @Roles(...ISOLATION_READ_ROLES)
  @Get('isolation-executions/:id/evidence/:evidenceId/download-url')
  evidenceDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.evidenceDownloadUrl(id, evidenceId, user);
  }
}
