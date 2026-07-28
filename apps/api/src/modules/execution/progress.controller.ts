import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { EXECUTION_READ_ROLES, EXECUTION_WRITE_ROLES } from './execution.constants';
import { ProgressUpdateDto } from './dto/progress-update.dto';
import { ProgressService } from './progress.service';

@Controller('permits')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Roles(...EXECUTION_WRITE_ROLES)
  @Post(':id/progress')
  addProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProgressUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.progressService.addProgress(id, dto, user);
  }

  @Roles(...EXECUTION_READ_ROLES)
  @Get(':id/progress')
  listProgress(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.progressService.listProgress(id, user);
  }
}
