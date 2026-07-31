import {
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { permits } from './permit';

export const DAILY_PROGRESS_STATUSES = ['draft', 'submitted'] as const;
export type DailyProgressStatus = (typeof DAILY_PROGRESS_STATUSES)[number];

export const HANDOVER_STATUSES = ['submitted'] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

export const DAILY_ACTIVITY_EVENT_TYPES = [
  'progress_recorded',
  'progress_submitted',
  'handover_completed',
] as const;
export type DailyActivityEventType = (typeof DAILY_ACTIVITY_EVENT_TYPES)[number];

export const permitDailyProgress = pgTable(
  'permit_daily_progress',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    operationalDate: date('operational_date').notNull(),
    completedWork: text('completed_work').notNull(),
    pendingWork: text('pending_work').notNull().default(''),
    summary: text('summary').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    recordedBy: uuid('recorded_by').notNull(),
    submittedBy: uuid('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    attachmentMeta: jsonb('attachment_meta').$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex('permit_daily_progress_tenant_permit_day_unique').on(
      table.tenantId,
      table.permitId,
      table.operationalDate,
    ),
    index('permit_daily_progress_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('permit_daily_progress_permit_day_idx').on(table.permitId, table.operationalDate),
  ],
);

export const shiftHandovers = pgTable(
  'shift_handovers',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    dailyProgressId: uuid('daily_progress_id').references(() => permitDailyProgress.id, {
      onDelete: 'set null',
    }),
    outgoingUserId: uuid('outgoing_user_id').notNull(),
    incomingUserId: uuid('incoming_user_id').notNull(),
    completedActivities: text('completed_activities').notNull(),
    outstandingWork: text('outstanding_work').notNull(),
    safetyObservations: text('safety_observations').notNull().default(''),
    handedOverAt: timestamp('handed_over_at', { withTimezone: true }).notNull().defaultNow(),
    status: varchar('status', { length: 32 }).notNull().default('submitted'),
  },
  (table) => [
    index('shift_handovers_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('shift_handovers_permit_handed_over_at_idx').on(table.permitId, table.handedOverAt),
    index('shift_handovers_daily_progress_id_idx').on(table.dailyProgressId),
  ],
);

export const dailyActivityHistory = pgTable(
  'daily_activity_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    actorId: uuid('actor_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('daily_activity_history_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('daily_activity_history_permit_created_at_idx').on(table.permitId, table.createdAt),
  ],
);
