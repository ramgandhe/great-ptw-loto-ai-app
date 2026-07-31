import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';

/** FR-NOT-001…008 + FR-NTF reminder/escalation triggers. */
export const NOTIFICATION_EVENT_TYPES = [
  'permit_submitted',
  'permit_approved',
  'permit_rejected',
  'permit_deferred',
  'permit_expiry',
  'incident_reported',
  'simops_conflict',
  'lototo_verification',
  'task_reminder',
  'escalation',
] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_CATEGORIES = [
  'workflow',
  'reminder',
  'escalation',
  'system',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = [
  'pending',
  'delivered',
  'failed',
  'suppressed',
] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const NOTIFICATION_HISTORY_ACTIONS = [
  'created',
  'queued',
  'delivered',
  'failed',
  'retried',
  'read',
  'escalated',
] as const;
export type NotificationHistoryAction = (typeof NOTIFICATION_HISTORY_ACTIONS)[number];

export const notifications = pgTable(
  'notifications',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    priority: varchar('priority', { length: 32 }).notNull().default('medium'),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    entityType: varchar('entity_type', { length: 64 }),
    entityId: uuid('entity_id'),
    dedupeKey: varchar('dedupe_key', { length: 255 }),
    sourceModule: varchar('source_module', { length: 64 }),
  },
  (table) => [
    uniqueIndex('notifications_tenant_dedupe_key_unique').on(table.tenantId, table.dedupeKey),
    index('notifications_tenant_id_idx').on(table.tenantId),
    index('notifications_tenant_event_type_idx').on(table.tenantId, table.eventType),
    index('notifications_tenant_category_idx').on(table.tenantId, table.category),
    index('notifications_tenant_created_at_idx').on(table.tenantId, table.createdAt),
    index('notifications_entity_idx').on(table.entityType, table.entityId),
  ],
);

export const notificationRecipients = pgTable(
  'notification_recipients',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'restrict' }),
    userId: uuid('user_id').notNull(),
    channel: varchar('channel', { length: 32 }).notNull().default('in_app'),
    deliveryStatus: varchar('delivery_status', { length: 32 }).notNull().default('pending'),
    readAt: timestamp('read_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    retryCount: integer('retry_count').notNull().default(0),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('notification_recipients_notification_user_channel_unique').on(
      table.notificationId,
      table.userId,
      table.channel,
    ),
    index('notification_recipients_tenant_id_idx').on(table.tenantId),
    index('notification_recipients_tenant_user_idx').on(table.tenantId, table.userId),
    index('notification_recipients_tenant_status_idx').on(table.tenantId, table.deliveryStatus),
    index('notification_recipients_next_retry_at_idx').on(table.nextRetryAt),
  ],
);

export const notificationHistory = pgTable(
  'notification_history',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'restrict' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => notificationRecipients.id, { onDelete: 'restrict' }),
    action: varchar('action', { length: 32 }).notNull(),
    detail: text('detail'),
  },
  (table) => [
    index('notification_history_tenant_id_idx').on(table.tenantId),
    index('notification_history_notification_id_idx').on(table.notificationId),
    index('notification_history_recipient_id_idx').on(table.recipientId),
    index('notification_history_tenant_action_idx').on(table.tenantId, table.action),
  ],
);
