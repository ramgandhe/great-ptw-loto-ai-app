import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CLOSURE_ARCHIVE_READ_ROLES } from './closure.constants';
import { ArchiveService } from './archive.service';
import { ArchiveSearchDto } from './dto/archive-search.dto';

@Controller('permits/archive')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Roles(...CLOSURE_ARCHIVE_READ_ROLES)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ArchiveSearchDto) {
    return this.archiveService.search(user, query);
  }

  @Roles(...CLOSURE_ARCHIVE_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.findOne(id, user);
  }
}
