import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  ApplyPersonalLockDto,
  CreateLockboxDto,
  ReleaseLockboxDto,
  SealLockboxDto,
} from './dto/isolation-lockbox.dto';
import { LOTOTO_LIBRARY_READ_ROLES, LOTOTO_WRITE_ROLES } from './lototo.constants';
import { IsolationLockboxService } from './isolation-lockbox.service';

@Controller('lototo')
export class IsolationLockboxController {
  constructor(private readonly lockboxService: IsolationLockboxService) {}

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('certificates/:id/lockboxes')
  createLockbox(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLockboxDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockboxService.createLockbox(id, dto, user);
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get('certificates/:id/lockboxes')
  getLockboxes(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockboxService.getLockboxesForCertificate(id, user);
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get('lockboxes/:lockboxId')
  getLockbox(
    @Param('lockboxId', ParseUUIDPipe) lockboxId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockboxService.getLockbox(lockboxId, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('lockboxes/:lockboxId/seal')
  sealLockbox(
    @Param('lockboxId', ParseUUIDPipe) lockboxId: string,
    @Body() dto: SealLockboxDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockboxService.sealLockbox(lockboxId, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator')
  @Post('lockboxes/:lockboxId/release')
  releaseLockbox(
    @Param('lockboxId', ParseUUIDPipe) lockboxId: string,
    @Body() dto: ReleaseLockboxDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockboxService.releaseLockbox(lockboxId, dto, user);
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get('certificates/:id/personal-locks')
  describePersonalLocks(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockboxService.describePersonalLocks(id, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator', 'permit-receiver')
  @Post('lockboxes/:lockboxId/crew-locks')
  applyPersonalLock(
    @Param('lockboxId', ParseUUIDPipe) lockboxId: string,
    @Body() dto: ApplyPersonalLockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockboxService.applyPersonalLock(lockboxId, dto, user);
  }

  @Roles(...LOTOTO_WRITE_ROLES, 'permit-operator', 'permit-receiver')
  @Delete('lockboxes/:lockboxId/crew-locks/:lockId')
  removePersonalLock(
    @Param('lockboxId', ParseUUIDPipe) lockboxId: string,
    @Param('lockId', ParseUUIDPipe) lockId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockboxService.removePersonalLock(lockboxId, lockId, user);
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get('lockboxes/:lockboxId/crew-locks')
  getRoster(
    @Param('lockboxId', ParseUUIDPipe) lockboxId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lockboxService.getLockboxRoster(lockboxId, user);
  }
}
