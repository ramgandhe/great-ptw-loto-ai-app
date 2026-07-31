import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import { notificationHistory, notificationRecipients } from '../../database/schema';
import { NotificationCacheService } from './notification-cache.service';
import { NotificationLogService } from './notification-log.service';

/** In-app delivery status updates and failure recording (BR-NTF-005). */
@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cache: NotificationCacheService,
    private readonly logService: NotificationLogService,
  ) {}

  async markDelivered(recipientId: string, user: AuthenticatedUser) {
    const actorId = requireActorId(user);
    const recipient = await this.requireRecipient(recipientId, user.tenantId!);

    const [updated] = await this.db
      .update(notificationRecipients)
      .set({
        deliveryStatus: 'delivered',
        deliveredAt: new Date(),
        failedAt: null,
        failureReason: null,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(notificationRecipients.id, recipient.id))
      .returning();

    await this.db.insert(notificationHistory).values({
      tenantId: recipient.tenantId,
      notificationId: recipient.notificationId,
      recipientId: updated.id,
      action: 'delivered',
      detail: `Delivered via ${updated.channel}`,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.cache.invalidateUser(recipient.tenantId, recipient.userId);
    this.logService.logEvent({
      action: 'notification.delivered',
      notificationId: recipient.notificationId,
      recipientId: updated.id,
      tenantId: recipient.tenantId,
      userId: recipient.userId,
      metadata: { channel: updated.channel },
    });

    return updated;
  }

  async markFailed(recipientId: string, reason: string, user: AuthenticatedUser) {
    const actorId = requireActorId(user);
    const recipient = await this.requireRecipient(recipientId, user.tenantId!);
    const retryCount = recipient.retryCount + 1;
    const nextRetryAt = new Date(Date.now() + retryCount * 5 * 60 * 1000);

    const [updated] = await this.db
      .update(notificationRecipients)
      .set({
        deliveryStatus: 'failed',
        failedAt: new Date(),
        failureReason: reason,
        retryCount,
        nextRetryAt,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(notificationRecipients.id, recipient.id))
      .returning();

    await this.db.insert(notificationHistory).values({
      tenantId: recipient.tenantId,
      notificationId: recipient.notificationId,
      recipientId: updated.id,
      action: 'failed',
      detail: reason,
      createdBy: actorId,
      updatedBy: actorId,
    });

    this.logService.logEvent({
      action: 'notification.failed',
      notificationId: recipient.notificationId,
      recipientId: updated.id,
      tenantId: recipient.tenantId,
      userId: recipient.userId,
      metadata: { reason, retryCount, nextRetryAt },
    });

    return updated;
  }

  private async requireRecipient(recipientId: string, tenantId: string) {
    const [recipient] = await this.db
      .select()
      .from(notificationRecipients)
      .where(
        and(
          eq(notificationRecipients.id, recipientId),
          eq(notificationRecipients.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!recipient) {
      throw new NotFoundException('Notification recipient not found');
    }

    return recipient;
  }
}
