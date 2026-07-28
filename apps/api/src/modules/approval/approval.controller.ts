import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { APPROVAL_ACTION_ROLES, APPROVAL_READ_ROLES } from './approval.constants';
import { ApprovalAttachmentService } from './approval-attachment.service';
import { ApprovalService } from './approval.service';
import { ApprovePermitDto } from './dto/approve-permit.dto';
import { DeferPermitDto } from './dto/defer-permit.dto';
import { RejectPermitDto } from './dto/reject-permit.dto';

@Controller('approvals')
export class ApprovalController {
  constructor(
    private readonly approvalService: ApprovalService,
    private readonly approvalAttachmentService: ApprovalAttachmentService,
  ) {}

  @Roles(...APPROVAL_READ_ROLES)
  @Get()
  listPending(@CurrentUser() user: AuthenticatedUser) {
    return this.approvalService.listPending(user);
  }

  @Roles(...APPROVAL_READ_ROLES)
  @Get(':permitId')
  review(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalService.review(permitId, user);
  }

  @Roles(...APPROVAL_ACTION_ROLES)
  @Post(':permitId/approve')
  approve(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Body() dto: ApprovePermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalService.approve(permitId, dto, user);
  }

  @Roles(...APPROVAL_ACTION_ROLES)
  @Post(':permitId/reject')
  reject(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Body() dto: RejectPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalService.reject(permitId, dto, user);
  }

  @Roles(...APPROVAL_ACTION_ROLES)
  @Post(':permitId/defer')
  defer(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Body() dto: DeferPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalService.defer(permitId, dto, user);
  }

  @Roles(...APPROVAL_READ_ROLES)
  @Get(':permitId/history')
  history(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalService.getHistory(permitId, user);
  }

  @Roles(...APPROVAL_READ_ROLES)
  @Get(':permitId/attachments/:attachmentId/download-url')
  attachmentDownloadUrl(
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalAttachmentService.getDownloadUrl(permitId, attachmentId, user);
  }
}
