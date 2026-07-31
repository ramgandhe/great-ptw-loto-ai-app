import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { EvidenceDownloadUrlDto } from './dto/evidence-download-url.dto';
import { EvidenceUploadUrlDto } from './dto/evidence-upload-url.dto';
import { RemoveLockDto } from './dto/remove-lock.dto';
import { RemoveTagDto } from './dto/remove-tag.dto';
import { RestoreEquipmentDto } from './dto/restore-equipment.dto';
import { RestorationVerificationDto } from './dto/restoration-verification.dto';
import { RestorationService } from './restoration.service';
import { VerificationService } from './verification.service';
import {
  RESTORATION_ACTION_ROLES,
  RESTORATION_READ_ROLES,
  RESTORATION_VERIFY_ROLES,
} from './restoration.constants';

@Controller('isolation-executions/:id/restoration')
export class RestorationController {
  constructor(
    private readonly restorationService: RestorationService,
    private readonly verificationService: VerificationService,
  ) {}

  @Roles(...RESTORATION_READ_ROLES)
  @Get()
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.restorationService.getRestoration(id, user);
  }

  @Roles(...RESTORATION_ACTION_ROLES)
  @Post('locks/remove')
  removeLock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveLockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restorationService.removeLock(id, dto.appliedLockId, dto.reason, user);
  }

  @Roles(...RESTORATION_ACTION_ROLES)
  @Post('tags/remove')
  removeTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restorationService.removeTag(id, dto.appliedTagId, dto.reason, user);
  }

  @Roles(...RESTORATION_ACTION_ROLES)
  @Post('equipment')
  restoreEquipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestoreEquipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restorationService.restoreEquipment(id, dto, user);
  }

  @Roles(...RESTORATION_VERIFY_ROLES)
  @Post('verifications')
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestorationVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.verificationService.record(id, dto, user);
  }

  @Roles(...RESTORATION_ACTION_ROLES)
  @Post('complete')
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.restorationService.completeRestoration(id, user);
  }

  @Roles(...RESTORATION_ACTION_ROLES)
  @Post('evidence/upload-url')
  evidenceUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvidenceUploadUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restorationService.evidenceUploadUrl(id, dto, user);
  }

  @Roles(...RESTORATION_READ_ROLES)
  @Post('evidence/download-url')
  evidenceDownloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvidenceDownloadUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.restorationService.evidenceDownloadUrl(id, dto.storageKey, user);
  }
}
