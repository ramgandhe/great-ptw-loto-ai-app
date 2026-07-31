import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateReminderDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ReminderService {
  constructor(private readonly notificationsService: NotificationsService) {}

  createReminder(dto: CreateReminderDto, user: AuthenticatedUser) {
    return this.notificationsService.generate(
      {
        eventType: 'task_reminder',
        category: 'reminder',
        priority: 'medium',
        title: dto.title,
        body: dto.body,
        recipientUserIds: [dto.recipientUserId],
        entityId: dto.entityId,
        entityType: dto.entityType,
        dedupeKey: dto.dedupeKey,
        sourceModule: 'reminder',
      },
      user,
    );
  }
}
