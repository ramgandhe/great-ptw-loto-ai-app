import {
  bigint,
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

export const PERMIT_STATUS_HISTORY_ACTIONS = [
  'activated',
  'suspended',
  'resumed',
  'verified',
  'closed',
] as const;
export type PermitStatusHistoryAction = (typeof PERMIT_STATUS_HISTORY_ACTIONS)[number];

export const permitExecution = pgTable(
  'permit_execution',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
    activatedBy: uuid('activated_by').notNull(),
    actualStartAt: timestamp('actual_start_at', { withTimezone: true }).notNull(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspendedBy: uuid('suspended_by'),
    suspensionReason: text('suspension_reason'),
    resumedAt: timestamp('resumed_at', { withTimezone: true }),
    resumedBy: uuid('resumed_by'),
  },
  (table) => [
    uniqueIndex('permit_execution_permit_id_unique').on(table.permitId),
    index('permit_execution_activated_by_idx').on(table.activatedBy),
  ],
);

export const permitProgress = pgTable(
  'permit_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => permitExecution.id, { onDelete: 'restrict' }),
    summary: text('summary').notNull(),
    recordedBy: uuid('recorded_by').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('permit_progress_permit_id_idx').on(table.permitId),
    index('permit_progress_execution_id_idx').on(table.executionId),
    index('permit_progress_permit_recorded_at_idx').on(table.permitId, table.recordedAt),
  ],
);

export const permitEvidence = pgTable(
  'permit_evidence',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => permitExecution.id, { onDelete: 'restrict' }),
    progressId: uuid('progress_id').references(() => permitProgress.id, {
      onDelete: 'set null',
    }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 128 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    storageBucket: varchar('storage_bucket', { length: 128 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    checksum: varchar('checksum', { length: 128 }),
    comment: text('comment'),
    uploadedBy: uuid('uploaded_by').notNull(),
  },
  (table) => [
    index('permit_evidence_permit_id_idx').on(table.permitId),
    index('permit_evidence_execution_id_idx').on(table.executionId),
    index('permit_evidence_progress_id_idx').on(table.progressId),
  ],
);

export const permitStatusHistory = pgTable(
  'permit_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id').references(() => permitExecution.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 64 }).notNull(),
    fromStatus: varchar('from_status', { length: 32 }),
    toStatus: varchar('to_status', { length: 32 }),
    actorId: uuid('actor_id').notNull(),
    comment: text('comment'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('permit_status_history_permit_id_idx').on(table.permitId),
    index('permit_status_history_permit_created_at_idx').on(table.permitId, table.createdAt),
    index('permit_status_history_actor_id_idx').on(table.actorId),
  ],
);
