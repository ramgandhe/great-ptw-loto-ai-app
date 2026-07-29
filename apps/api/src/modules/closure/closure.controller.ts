import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CLOSURE_CLOSE_ROLES,
  CLOSURE_HISTORY_READ_ROLES,
  CLOSURE_VERIFY_ROLES,
} from './closure.constants';
import { ClosureService } from './closure.service';
import { ClosePermitDto } from './dto/close-permit.dto';
import { VerificationDto } from './dto/verification.dto';
import { HistoryService } from './history.service';
import { VerificationService } from './verification.service';

@Controller('permits')
export class ClosureController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly closureService: ClosureService,
    private readonly historyService: HistoryService,
  ) {}

  @Roles(...CLOSURE_VERIFY_ROLES)
  @Post(':id/verify')
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.verificationService.verify(id, dto, user);
  }

  @Roles(...CLOSURE_CLOSE_ROLES)
  @Post(':id/close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClosePermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.closureService.close(id, dto, user);
  }

  @Roles(...CLOSURE_HISTORY_READ_ROLES)
  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.historyService.getHistory(id, user);
  }

  @Roles(...CLOSURE_HISTORY_READ_ROLES)
  @Get(':id/audit')
  audit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.historyService.getAudit(id, user);
  }
}
