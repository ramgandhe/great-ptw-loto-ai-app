import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  RecordLototoCrewActionDto,
  RecordLototoPointVerificationDto,
  RecordLototoRestoreVerificationDto,
} from './dto/permit-lototo-execution.dto';
import { LOTOTO_EXECUTE_ROLES, PERMIT_READ_ROLES } from './permit.constants';
import { PermitLototoExecutionService } from './permit-lototo-execution.service';

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
}
