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
import { MASTER_DATA_WRITE_ROLES } from './master-data.constants';
import { BulkImportDto } from './dto/bulk-import.dto';
import { ImportService } from './import.service';

@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Post('master-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: UploadedFilePayload,
    @Body() dto: BulkImportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importService.upload(file, dto, user);
  }

  @Roles(...MASTER_DATA_WRITE_ROLES)
  @Get(':id')
  status(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.importService.getStatus(id, user);
  }
}
