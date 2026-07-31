import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateTestNotificationDto, ListNotificationsQueryDto } from './dto/notification.dto';
import { NOTIFICATION_READ_ROLES, NOTIFICATION_TEST_ROLES } from './notifications.constants';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Roles(...NOTIFICATION_READ_ROLES)
  @Get()
  list(@Query() query: ListNotificationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.list(user, query.unreadOnly === true);
  }

  @Roles(...NOTIFICATION_TEST_ROLES)
  @Post('test')
  createTest(@Body() dto: CreateTestNotificationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.createTest(dto, user);
  }

  @Roles(...NOTIFICATION_READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findOne(id, user);
  }

  @Roles(...NOTIFICATION_READ_ROLES)
  @Patch(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user);
  }
}
