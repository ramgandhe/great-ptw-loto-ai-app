import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  notificationHistory,
  notificationPreferences,
  notificationRecipients,
  notifications,
  NOTIFICATION_EVENT_TYPES,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { NotificationCacheService } from './notification-cache.service';
import { NotificationLogService } from './notification-log.service';
import { FR_NOT_EVENT_TRACEABILITY, FrNotRequirementId } from './notifications.constants';

export type DispatchNotificationInput = {
  tenantId: string;
  actorId: string;
  requirementId: FrNotRequirementId;
  title: string;
  body: string;
  recipientUserIds: string[];
  entityType?: string;
  entityId?: string;
  dedupeKey: string;
  sourceModule: string;
  channel?: 'in_app' | 'email' | 'push';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'workflow' | 'reminder' | 'escalation' | 'system';
};

/**
 * FR-NOT-002…008 operational dispatcher.
 * Preference-aware, tenant-scoped, dedupe-idempotent. Does not use FR-NTF as evidence.
 */
@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger(NotificationDispatchService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cache: NotificationCacheService,
    private readonly logService: NotificationLogService,
    private readonly auditService: AuditService,
  ) {}

  getEventType(requirementId: FrNotRequirementId) {
    return FR_NOT_EVENT_TRACEABILITY[requirementId];
  }

  async isChannelEnabled(
    tenantId: string,
    eventType: string,
    channel: string,
  ): Promise<boolean> {
    const prefs = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.tenantId, tenantId),
          eq(notificationPreferences.status, 'active'),
        ),
      );

    if (prefs.length === 0) {
      return true;
    }

    const matching = prefs.filter(
      (pref) =>
        (!pref.eventType || pref.eventType === eventType) &&
        (!pref.channel || pref.channel === channel),
    );

    if (matching.length === 0) {
      return true;
    }

    // Any explicit disable suppresses; otherwise enabled if any matching pref is enabled.
    if (matching.some((pref) => pref.enabled === false)) {
      return false;
    }
    return matching.some((pref) => pref.enabled === true);
  }

  async dispatch(input: DispatchNotificationInput) {
    const eventType = this.getEventType(input.requirementId);
    if (!(NOTIFICATION_EVENT_TYPES as readonly string[]).includes(eventType)) {
      this.logger.warn(`Missing template/event type for ${input.requirementId}`);
      return { suppressed: true as const, reason: 'missing_template' as const };
    }

    const channel = input.channel ?? 'in_app';
    const enabled = await this.isChannelEnabled(input.tenantId, eventType, channel);
    if (!enabled) {
      this.logService.logEvent({
        action: 'notification.suppressed_preference',
        tenantId: input.tenantId,
        userId: input.actorId,
        metadata: { requirementId: input.requirementId, eventType, channel },
      });
      return { suppressed: true as const, reason: 'preference_disabled' as const };
    }

    const uniqueRecipients = [
      ...new Set(input.recipientUserIds.filter((id) => Boolean(id) && id !== input.actorId)),
    ];
    // Still notify actor when they are the only stakeholder (e.g. self-reported).
    const recipients =
      uniqueRecipients.length > 0
        ? uniqueRecipients
        : [...new Set(input.recipientUserIds.filter(Boolean))];

    if (recipients.length === 0) {
      return { suppressed: true as const, reason: 'no_recipients' as const };
    }

    const [existing] = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, input.tenantId),
          eq(notifications.dedupeKey, input.dedupeKey),
        ),
      )
      .limit(1);

    if (existing) {
      const existingRecipients = await this.db
        .select()
        .from(notificationRecipients)
        .where(eq(notificationRecipients.notificationId, existing.id));
      return {
        notification: existing,
        recipients: existingRecipients,
        deduplicated: true as const,
        suppressed: false as const,
      };
    }

    const [notification] = await this.db
      .insert(notifications)
      .values({
        tenantId: input.tenantId,
        eventType,
        category: input.category ?? 'workflow',
        priority: input.priority ?? 'medium',
        title: input.title,
        body: input.body,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        dedupeKey: input.dedupeKey,
        sourceModule: input.sourceModule,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      })
      .returning();

    const recipientRows = await this.db
      .insert(notificationRecipients)
      .values(
        recipients.map((userId) => ({
          tenantId: input.tenantId,
          notificationId: notification.id,
          userId,
          channel,
          deliveryStatus: 'pending' as const,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        })),
      )
      .returning();

    for (const recipient of recipientRows) {
      await this.db.insert(notificationHistory).values({
        tenantId: input.tenantId,
        notificationId: notification.id,
        recipientId: recipient.id,
        action: 'created',
        detail: `${input.requirementId}:${eventType}`,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      });
      await this.cache.invalidateUser(input.tenantId, recipient.userId);
    }

    this.logService.logEvent({
      action: 'notification.dispatched',
      notificationId: notification.id,
      tenantId: input.tenantId,
      userId: input.actorId,
      metadata: {
        requirementId: input.requirementId,
        eventType,
        recipientCount: recipientRows.length,
      },
    });

    await this.auditService.log({
      action: 'notification.dispatched',
      entityType: 'notification',
      entityId: notification.id,
      userId: input.actorId,
      tenantId: input.tenantId,
      metadata: { requirementId: input.requirementId, eventType },
    });

    return {
      notification,
      recipients: recipientRows,
      deduplicated: false as const,
      suppressed: false as const,
    };
  }
}
