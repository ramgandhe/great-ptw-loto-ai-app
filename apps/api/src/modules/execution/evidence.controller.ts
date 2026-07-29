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
  EXECUTION_READ_ROLES,
  EXECUTION_UPDATE_ROLES,
  MAX_EVIDENCE_SIZE_BYTES,
} from './execution.constants';
import { UploadEvidenceDto } from './dto/upload-evidence.dto';
import { EvidenceService } from './evidence.service';
import { ExecutionEvidenceService } from './execution-evidence.service';

@Controller('permits')
export class EvidenceController {
  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly executionEvidenceService: ExecutionEvidenceService,
  ) {}

  @Roles(...EXECUTION_UPDATE_ROLES)
  @Post(':id/evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_EVIDENCE_SIZE_BYTES },
    }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFilePayload,
    @Body() dto: UploadEvidenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.evidenceService.upload(id, file, dto, user);
  }

  @Roles(...EXECUTION_READ_ROLES)
  @Get(':id/evidence')
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.evidenceService.list(id, user);
  }

  @Roles(...EXECUTION_READ_ROLES)
  @Get(':id/evidence/:evidenceId/download-url')
  downloadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.executionEvidenceService.getDownloadUrl(id, evidenceId, user);
  }
}
