import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';
import {
  ActivatePermitDto,
  ProgressUpdateDto,
  ResumePermitDto,
  SuspendPermitDto,
  UploadEvidenceDto,
} from './dto/execution.dto';
import {
  EXECUTION_ACTION_ROLES,
  EXECUTION_READ_ROLES,
} from './execution.constants';
import { ExecutionService } from './execution.service';

@Controller('permits')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Roles(...EXECUTION_READ_ROLES)
  @Get(':id/execution')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.get(id, user);
  }

  @Roles(...EXECUTION_ACTION_ROLES)
  @Post(':id/activate')
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActivatePermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.activate(id, dto, user);
  }

  @Roles(...EXECUTION_ACTION_ROLES)
  @Post(':id/progress')
  addProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProgressUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.addProgress(id, dto, user);
  }

  @Roles(...EXECUTION_ACTION_ROLES)
  @Post(':id/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadEvidenceDto,
    @UploadedFile() file: UploadedFilePayload,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.uploadEvidence(id, dto, file, user);
  }

  @Roles(...EXECUTION_ACTION_ROLES)
  @Post(':id/suspend')
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendPermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.suspend(id, dto, user);
  }

  @Roles('supervisor', 'org-admin', 'platform-admin')
  @Post(':id/resume')
  resume(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResumePermitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionService.resume(id, dto, user);
  }
}
