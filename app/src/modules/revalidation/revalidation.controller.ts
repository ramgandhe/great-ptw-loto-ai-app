import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  DecideExtensionDto,
  RequestExtensionDto,
  RevalidatePermitDto,
  SuspendPermitDto,
} from './dto/revalidation.dto';
import {
  EXTENSION_APPROVE_ROLES,
  EXTENSION_REQUEST_ROLES,
  REVALIDATION_READ_ROLES,
  REVALIDATION_WRITE_ROLES,
} from './revalidation.constants';
import { RevalidationService } from './revalidation.service';

@Controller()
export class RevalidationController {
  constructor(private readonly revalidationService: RevalidationService) {}

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
}
