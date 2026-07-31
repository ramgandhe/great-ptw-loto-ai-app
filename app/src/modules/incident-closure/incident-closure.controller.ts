import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CloseIncidentDto,
  IncidentArchiveSearchDto,
  VerifyIncidentDto,
} from './dto/incident-closure.dto';
import {
  INCIDENT_ARCHIVE_READ_ROLES,
  INCIDENT_CLOSE_ROLES,
  INCIDENT_VERIFY_ROLES,
} from './incident-closure.constants';
import { IncidentClosureService } from './incident-closure.service';

@Controller('incidents')
export class IncidentClosureController {
  constructor(private readonly closureService: IncidentClosureService) {}

  @Roles(...INCIDENT_ARCHIVE_READ_ROLES)
  @Get('archive')
  listArchive(@Query() query: IncidentArchiveSearchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.closureService.listArchive(user, query);
  }

  @Roles(...INCIDENT_ARCHIVE_READ_ROLES)
  @Get('archive/:id')
  getArchive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.closureService.getArchive(id, user);
  }

  @Roles(...INCIDENT_VERIFY_ROLES)
  @Post(':id/verify')
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.closureService.verify(id, dto, user);
  }

  @Roles(...INCIDENT_CLOSE_ROLES)
  @Post(':id/close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.closureService.close(id, dto, user);
  }

  @Roles(...INCIDENT_ARCHIVE_READ_ROLES)
  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.closureService.getHistory(id, user);
  }
}
