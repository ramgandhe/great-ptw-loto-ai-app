import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  AssignInvestigationDto,
  CorrectiveActionDto,
  PreventiveActionDto,
  RootCauseAnalysisDto,
  UpdateCorrectiveActionDto,
} from './dto/investigation.dto';
import {
  CORRECTIVE_ACTION_UPDATE_ROLES,
  INVESTIGATION_ASSIGN_ROLES,
  INVESTIGATION_READ_ROLES,
  INVESTIGATION_WRITE_ROLES,
} from './investigation.constants';
import { InvestigationService } from './investigation.service';

@Controller('incidents/:id')
export class InvestigationController {
  constructor(private readonly investigationService: InvestigationService) {}

  @Roles(...INVESTIGATION_ASSIGN_ROLES)
  @Post('assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignInvestigationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.investigationService.assign(id, dto, user);
  }

  @Roles(...INVESTIGATION_WRITE_ROLES)
  @Post('root-cause')
  rootCause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RootCauseAnalysisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.investigationService.recordRootCause(id, dto, user);
  }

  @Roles(...INVESTIGATION_WRITE_ROLES)
  @Post('corrective-actions')
  createCorrective(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectiveActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.investigationService.createCorrectiveAction(id, dto, user);
  }

  @Roles(...INVESTIGATION_WRITE_ROLES)
  @Post('preventive-actions')
  createPreventive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreventiveActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.investigationService.createPreventiveAction(id, dto, user);
  }

  @Roles(...INVESTIGATION_READ_ROLES)
  @Get('investigation')
  getInvestigation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.investigationService.getInvestigation(id, user);
  }
}

@Controller('corrective-actions')
export class CorrectiveActionController {
  constructor(private readonly investigationService: InvestigationService) {}

  @Roles(...CORRECTIVE_ACTION_UPDATE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCorrectiveActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.investigationService.updateCorrectiveAction(id, dto, user);
  }
}
