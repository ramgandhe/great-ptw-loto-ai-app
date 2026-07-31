import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  notificationHistory,
  notificationRecipients,
  notifications,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { NotificationCacheService } from './notification-cache.service';
import { NotificationLogService } from './notification-log.service';
import { DeliveryService } from './delivery.service';
import { CreateTestNotificationDto, GenerateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cache: NotificationCacheService,
    private readonly logService: NotificationLogService,
    private readonly deliveryService: DeliveryService,
    private readonly auditService: AuditService,
  ) {}

  async list(user: AuthenticatedUser, unreadOnly = false) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);

    if (!unreadOnly) {
      const cached = await this.cache.getList<unknown>(tenantId, actorId);
      if (cached) {
        return cached;
      }
    }

    const conditions = [
      eq(notificationRecipients.tenantId, tenantId),
      eq(notificationRecipients.userId, actorId),
    ];
    if (unreadOnly) {
      conditions.push(isNull(notificationRecipients.readAt));
    }

    const rows = await this.db
      .select({
        notification: notifications,
        recipient: notificationRecipients,
      })
      .from(notificationRecipients)
      .innerJoin(notifications, eq(notificationRecipients.notificationId, notifications.id))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));

    const data = rows.map((row) => this.toUserNotification(row.notification, row.recipient));

    if (!unreadOnly) {
      await this.cache.setList(tenantId, actorId, data);
    }

    return data;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const row = await this.requireRecipientNotification(id, tenantId, actorId);
    return this.toUserNotification(row.notification, row.recipient);
  }

  async markRead(id: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const row = await this.requireRecipientNotification(id, tenantId, actorId);

    if (row.recipient.readAt) {
      return this.toUserNotification(row.notification, row.recipient);
    }

    const [updated] = await this.db
      .update(notificationRecipients)
      .set({
        readAt: new Date(),
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(notificationRecipients.id, row.recipient.id))
      .returning();

    await this.db.insert(notificationHistory).values({
      tenantId,
      notificationId: row.notification.id,
      recipientId: updated.id,
      action: 'read',
      detail: 'Marked as read by recipient',
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.cache.invalidateUser(tenantId, actorId);
    this.logService.logEvent({
      action: 'notification.read',
      notificationId: row.notification.id,
      recipientId: updated.id,
      tenantId,
      userId: actorId,
    });

    await this.auditService.log({
      action: 'notification.read',
      entityType: 'notification',
      entityId: row.notification.id,
      userId: actorId,
      tenantId,
    });

    return this.toUserNotification(row.notification, updated);
  }

  async createTest(dto: CreateTestNotificationDto, user: AuthenticatedUser) {
    const actorId = requireActorId(user);
    const created = await this.generate(
      {
        eventType: 'task_reminder',
        category: 'system',
        priority: 'low',
        title: dto.title ?? 'Test notification',
        body: dto.body ?? 'Test notification delivery',
        recipientUserIds: [actorId],
        channel: dto.channel ?? 'in_app',
        sourceModule: 'notifications',
        dedupeKey: `test:${actorId}:${Date.now()}`,
      },
      user,
    );

    const recipients = [];
    for (const recipient of created.recipients) {
      recipients.push(await this.deliveryService.markDelivered(recipient.id, user));
    }

    return { ...created, recipients };
  }

  async generate(dto: GenerateNotificationDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const channel = dto.channel ?? 'in_app';
    const uniqueRecipients = [...new Set(dto.recipientUserIds)];

    if (dto.dedupeKey) {
      const [existing] = await this.db
        .select()
        .from(notifications)
        .where(and(eq(notifications.tenantId, tenantId), eq(notifications.dedupeKey, dto.dedupeKey)))
        .limit(1);
      if (existing) {
        const recipients = await this.db
          .select()
          .from(notificationRecipients)
          .where(eq(notificationRecipients.notificationId, existing.id));
        return { notification: existing, recipients, deduplicated: true };
      }
    }

    const [notification] = await this.db
      .insert(notifications)
      .values({
        tenantId,
        eventType: dto.eventType,
        category: dto.category,
        priority: dto.priority ?? 'medium',
        title: dto.title,
        body: dto.body,
        entityType: dto.entityType ?? null,
        entityId: dto.entityId ?? null,
        dedupeKey: dto.dedupeKey ?? null,
        sourceModule: dto.sourceModule ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    const recipients = await this.db
      .insert(notificationRecipients)
      .values(
        uniqueRecipients.map((recipientUserId) => ({
          tenantId,
          notificationId: notification.id,
          userId: recipientUserId,
          channel,
          deliveryStatus: 'pending' as const,
          createdBy: actorId,
          updatedBy: actorId,
        })),
      )
      .returning();

    for (const recipient of recipients) {
      await this.db.insert(notificationHistory).values({
        tenantId,
        notificationId: notification.id,
        recipientId: recipient.id,
        action: 'created',
        detail: `Notification created (${dto.eventType})`,
        createdBy: actorId,
        updatedBy: actorId,
      });
      await this.cache.invalidateUser(tenantId, recipient.userId);
    }

    this.logService.logEvent({
      action: 'notification.created',
      notificationId: notification.id,
      tenantId,
      userId: actorId,
      metadata: { eventType: dto.eventType, recipientCount: recipients.length },
    });

    await this.auditService.log({
      action: 'notification.created',
      entityType: 'notification',
      entityId: notification.id,
      userId: actorId,
      tenantId,
      metadata: { eventType: dto.eventType, recipientCount: recipients.length },
    });

    return { notification, recipients, deduplicated: false };
  }

  private async requireRecipientNotification(
    notificationId: string,
    tenantId: string,
    userId: string,
  ) {
    const [row] = await this.db
      .select({
        notification: notifications,
        recipient: notificationRecipients,
      })
      .from(notificationRecipients)
      .innerJoin(notifications, eq(notificationRecipients.notificationId, notifications.id))
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notificationRecipients.tenantId, tenantId),
          eq(notificationRecipients.userId, userId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException('Notification not found');
    }

    return row;
  }

  private toUserNotification(
    notification: typeof notifications.$inferSelect,
    recipient: typeof notificationRecipients.$inferSelect,
  ) {
    return {
      id: notification.id,
      eventType: notification.eventType,
      category: notification.category,
      priority: notification.priority,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
      sourceModule: notification.sourceModule,
      createdAt: notification.createdAt,
      recipient: {
        id: recipient.id,
        channel: recipient.channel,
        deliveryStatus: recipient.deliveryStatus,
        readAt: recipient.readAt,
        deliveredAt: recipient.deliveredAt,
      },
    };
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
