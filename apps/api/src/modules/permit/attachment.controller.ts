import {
  Controller,
  Delete,
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
import { AttachmentService } from './attachment.service';
import { PERMIT_WRITE_ROLES } from './permit.constants';
import { UploadedFilePayload } from './uploaded-file.interface';

@Controller('permits')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Roles(...PERMIT_WRITE_ROLES)
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFilePayload,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentService.upload(id, file, user);
  }

  @Roles(...PERMIT_WRITE_ROLES)
  @Delete(':id/attachments/:attachmentId')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentService.remove(id, attachmentId, user);
  }
}
