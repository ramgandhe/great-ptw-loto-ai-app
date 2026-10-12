import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  ConfirmLototoPhaseDto,
  RecordLototoCrewActionDto,
  RecordLototoPointVerificationDto,
  RecordLototoRestoreVerificationDto,
  RestartLototoVerificationDto,
  TickLototoSequenceStepDto,
} from './dto/permit-lototo-execution.dto';
import { LOTOTO_EXECUTE_ROLES, PERMIT_READ_ROLES } from './permit.constants';
import { PermitLototoExecutionService } from './permit-lototo-execution.service';
import { UploadedFilePayload } from './uploaded-file.interface';

@Controller('permits/:permitId/lototo')
export class PermitLototoExecutionController {
  constructor(private readonly executionService: PermitLototoExecutionService) {}

  @Roles(...PERMIT_READ_ROLES)
  @Get('execution')
  getBoard(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.getBoard(permitId, user);
  }

  @Roles(...LOTOTO_EXECUTE_ROLES)
  @Post('instances/:instanceId/start')
  startIsolation(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.startIsolation(permitId, instanceId, user);
  }

  @Roles(...LOTOTO_EXECUTE_ROLES)
  @Post('instances/:instanceId/crew-complete')
  declareCrewComplete(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.declareCrewComplete(permitId, instanceId, user);
  }

  @Roles(...LOTOTO_EXECUTE_ROLES)
  @Post('instances/:instanceId/crew')
  recordCrew(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: RecordLototoCrewActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.recordCrewAction(permitId, instanceId, dto, user);
  }

  @Roles(...LOTOTO_EXECUTE_ROLES)
  @Post('instances/:instanceId/verify')
  recordVerify(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: RecordLototoPointVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.recordVerification(permitId, instanceId, dto, user);
  }

  @Roles(...LOTOTO_EXECUTE_ROLES)
  @Post('instances/:instanceId/restore')
  recordRestore(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: RecordLototoCrewActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.recordRestoration(permitId, instanceId, dto, user);
  }

  @Roles(...LOTOTO_EXECUTE_ROLES)
  @Post('instances/:instanceId/restore-verify')
  recordRestoreVerify(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: RecordLototoRestoreVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.recordRestorationVerification(permitId, instanceId, dto, user);
  }

  @Roles(...LOTOTO_EXECUTE_ROLES)
  @Post('instances/:instanceId/sequence-ticks')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  tickSequence(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: TickLototoSequenceStepDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedFilePayload,
  ) {
    return this.executionService.tickSequenceStep(permitId, instanceId, dto, user, file);
  }

  @Roles(...LOTOTO_EXECUTE_ROLES)
  @Post('instances/:instanceId/phase-confirm')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  confirmPhase(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: ConfirmLototoPhaseDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedFilePayload,
  ) {
    return this.executionService.confirmPhase(permitId, instanceId, dto, user, file);
  }

  @Roles(...LOTOTO_EXECUTE_ROLES)
  @Post('instances/:instanceId/restart-verification')
  restartVerification(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: RestartLototoVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.restartVerification(permitId, instanceId, dto, user);
  }
}
