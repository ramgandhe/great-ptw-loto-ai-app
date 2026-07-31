import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RecordVerificationDto } from './dto/record-verification.dto';
import { VerificationService } from './verification.service';
import { ISOLATION_READ_ROLES, ISOLATION_VERIFY_ROLES } from './isolation-execution.constants';

@Controller()
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Roles(...ISOLATION_VERIFY_ROLES)
  @Post('isolation-executions/:executionId/verifications')
  record(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Body() dto: RecordVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.verificationService.record(executionId, dto, user);
  }

  @Roles(...ISOLATION_READ_ROLES)
  @Get('isolation-executions/:executionId/verifications')
  list(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.verificationService.list(executionId, user);
  }
}
