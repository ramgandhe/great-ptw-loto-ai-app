import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { permits } from './permit';

export const permitExecutions = pgTable(
  'permit_executions',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull(),
    activatedBy: uuid('activated_by').notNull(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspendedBy: uuid('suspended_by'),
    suspensionReason: text('suspension_reason'),
    resumedAt: timestamp('resumed_at', { withTimezone: true }),
    resumedBy: uuid('resumed_by'),
  },
  (table) => [
    uniqueIndex('permit_executions_permit_id_unique').on(table.permitId),
    index('permit_executions_tenant_id_idx').on(table.tenantId),
    index('permit_executions_tenant_permit_idx').on(table.tenantId, table.permitId),
  ],
);

export const permitProgress = pgTable(
  'permit_progress',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    summary: text('summary').notNull(),
    recordedBy: uuid('recorded_by').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('permit_progress_tenant_id_idx').on(table.tenantId),
    index('permit_progress_permit_recorded_idx').on(table.permitId, table.recordedAt),
  ],
);

export const permitEvidence = pgTable(
  'permit_evidence',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    progressId: uuid('progress_id').references(() => permitProgress.id, {
      onDelete: 'set null',
    }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 128 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    storageBucket: varchar('storage_bucket', { length: 128 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    comment: text('comment'),
    uploadedBy: uuid('uploaded_by').notNull(),
  },
  (table) => [
    index('permit_evidence_tenant_id_idx').on(table.tenantId),
    index('permit_evidence_permit_id_idx').on(table.permitId),
    index('permit_evidence_progress_id_idx').on(table.progressId),
  ],
);

export const permitStatusHistory = pgTable(
  'permit_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    fromStatus: varchar('from_status', { length: 32 }).notNull(),
    toStatus: varchar('to_status', { length: 32 }).notNull(),
    reason: text('reason'),
    changedBy: uuid('changed_by').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('permit_status_history_tenant_id_idx').on(table.tenantId),
    index('permit_status_history_permit_changed_idx').on(table.permitId, table.changedAt),
  ],
);
