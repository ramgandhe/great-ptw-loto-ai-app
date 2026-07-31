import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApplyTagDto } from './dto/apply-tag.dto';
import { TagService } from './tag.service';
import { ISOLATION_ACTION_ROLES, ISOLATION_READ_ROLES } from './isolation-execution.constants';

@Controller()
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Roles(...ISOLATION_ACTION_ROLES)
  @Post('isolation-executions/:executionId/tags')
  apply(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Body() dto: ApplyTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tagService.apply(executionId, dto, user);
  }

  @Roles(...ISOLATION_READ_ROLES)
  @Get('isolation-executions/:executionId/tags')
  list(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tagService.list(executionId, user);
  }

  @Roles(...ISOLATION_ACTION_ROLES)
  @Post('tags/:tagId/remove')
  remove(@Param('tagId', ParseUUIDPipe) tagId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tagService.remove(tagId, user);
  }
}
