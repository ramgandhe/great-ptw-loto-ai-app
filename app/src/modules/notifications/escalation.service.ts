import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateEscalationDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';

@Injectable()
export class EscalationService {
  constructor(private readonly notificationsService: NotificationsService) {}

  createEscalation(dto: CreateEscalationDto, user: AuthenticatedUser) {
    return this.notificationsService.generate(
      {
        eventType: 'escalation',
        category: 'escalation',
        priority: dto.priority ?? 'critical',
        title: dto.title,
        body: dto.body,
        recipientUserIds: [dto.recipientUserId],
        entityId: dto.entityId,
        entityType: dto.entityType,
        dedupeKey: dto.dedupeKey,
        sourceModule: 'escalation',
      },
      user,
    );
  }
}
