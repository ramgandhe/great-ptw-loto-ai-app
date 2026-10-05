import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateLototoProcedureDto, UpdateLototoProcedureDto } from './dto/lototo-procedure.dto';
import { LOTOTO_LIBRARY_READ_ROLES, LOTOTO_LIBRARY_WRITE_ROLES } from './lototo.constants';
import { LototoProcedureService } from './lototo-procedure.service';
import { UploadedFilePayload } from '../permit/uploaded-file.interface';

@Controller('lototo/procedures')
export class LototoProcedureController {
  constructor(private readonly procedureService: LototoProcedureService) {}

  @Roles(...LOTOTO_LIBRARY_WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateLototoProcedureDto, @CurrentUser() user: AuthenticatedUser) {
    return this.procedureService.create(dto, user);
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('machineryId') machineryId?: string,
    @Query('published') published?: string,
  ) {
    return this.procedureService.list(user, machineryId, published === 'true');
  }

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procedureService.get(id, user);
  }

  @Roles(...LOTOTO_LIBRARY_WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLototoProcedureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.procedureService.update(id, dto, user);
  }

  @Roles(...LOTOTO_LIBRARY_WRITE_ROLES)
  @Post(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procedureService.publish(id, user);
  }

  @Roles(...LOTOTO_LIBRARY_WRITE_ROLES)
  @Post(':id/revisions')
  revise(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procedureService.createRevision(id, user);
  }

  @Roles(...LOTOTO_LIBRARY_WRITE_ROLES)
  @Post(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procedureService.deactivate(id, user);
  }

  @Roles(...LOTOTO_LIBRARY_WRITE_ROLES)
  @Post(':id/reactivate')
  reactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procedureService.reactivate(id, user);
  }

  @Roles(...LOTOTO_LIBRARY_WRITE_ROLES)
  @Post(':id/lockout-points/:pointId/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pointId', ParseUUIDPipe) pointId: string,
    @UploadedFile() file: UploadedFilePayload,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.procedureService.uploadPointPhoto(id, pointId, file, user);
  }

  @Roles(...LOTOTO_LIBRARY_WRITE_ROLES)
  @Delete(':id/lockout-points/:pointId/photo')
  removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pointId', ParseUUIDPipe) pointId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.procedureService.removePointPhoto(id, pointId, user);
  }

  @Roles(...LOTOTO_LIBRARY_WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procedureService.remove(id, user);
  }
}

@Controller('lototo/procedure-versions')
export class LototoProcedureVersionController {
  constructor(private readonly procedureService: LototoProcedureService) {}

  @Roles(...LOTOTO_LIBRARY_READ_ROLES)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.procedureService.getVersion(id, user);
  }
}
