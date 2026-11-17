import {
  bigint,
  boolean,
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

export const PERMIT_STATUS_HISTORY_ACTIONS = [
  'execution_released',
  'activated',
  'suspended',
  'resumed',
  'revalidated',
  'verified',
  'execution_completed',
  'sent_back',
  'closed',
  'cancelled',
  'expired',
  'work_paused',
  'work_resumed',
] as const;
export type PermitStatusHistoryAction = (typeof PERMIT_STATUS_HISTORY_ACTIONS)[number];

/** Operator work loop (locked Start → Pause ⇄ Resume → Complete). Not suspension. */
export const WORK_STATES = ['in_progress', 'paused'] as const;
export type WorkState = (typeof WORK_STATES)[number];

export const OVERNIGHT_ISOLATION_POLICIES = ['hold', 'restore_allowed'] as const;
export type OvernightIsolationPolicy = (typeof OVERNIGHT_ISOLATION_POLICIES)[number];

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
    /** in_progress | paused — Complete uses permit status execution_completed. */
    workState: varchar('work_state', { length: 32 }).notNull().default('in_progress'),
    workPausedAt: timestamp('work_paused_at', { withTimezone: true }),
    workPausedBy: uuid('work_paused_by'),
    workResumedAt: timestamp('work_resumed_at', { withTimezone: true }),
    workResumedBy: uuid('work_resumed_by'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspendedBy: uuid('suspended_by'),
    suspensionReason: text('suspension_reason'),
    resumedAt: timestamp('resumed_at', { withTimezone: true }),
    resumedBy: uuid('resumed_by'),
  },
  (table) => [
    uniqueIndex('permit_execution_permit_id_unique').on(table.permitId),
    index('permit_execution_activated_by_idx').on(table.activatedBy),
    index('permit_execution_work_state_idx').on(table.workState),
  ],
);

/** One Pause (daily leave-safe) record per work period. */
export const permitWorkPauses = pgTable(
  'permit_work_pauses',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => permitExecution.id, { onDelete: 'cascade' }),
    summary: text('summary').notNull(),
    checklist: jsonb('checklist').$type<Record<string, unknown>>().notNull().default({}),
    notes: text('notes').notNull().default(''),
    /** Live LOTOTO snapshot at pause (points/locks summary). */
    lototoSnapshot: jsonb('lototo_snapshot').$type<Record<string, unknown>>().notNull().default({}),
    /** Point/lock ids marked removed overnight (exception). */
    lototoRemovals: jsonb('lototo_removals').$type<string[]>().notNull().default([]),
    overnightRestoreChosen: boolean('overnight_restore_chosen').notNull().default(false),
    reisolateRequiredOnResume: boolean('reisolate_required_on_resume').notNull().default(false),
    pausedBy: uuid('paused_by').notNull(),
    pausedAt: timestamp('paused_at', { withTimezone: true }).notNull().defaultNow(),
    /** Site calendar date of the pause. Cut-off does not roll this date. */
    operationalDate: date('operational_date').notNull(),
  },
  (table) => [
    index('permit_work_pauses_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('permit_work_pauses_execution_idx').on(table.executionId),
    index('permit_work_pauses_permit_paused_at_idx').on(table.permitId, table.pausedAt),
  ],
);

/** One Resume (re-clear) record after a Pause. */
export const permitWorkResumes = pgTable(
  'permit_work_resumes',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => permitExecution.id, { onDelete: 'cascade' }),
    pauseId: uuid('pause_id')
      .notNull()
      .references(() => permitWorkPauses.id, { onDelete: 'cascade' }),
    checklist: jsonb('checklist').$type<Record<string, unknown>>().notNull().default({}),
    notes: text('notes').notNull().default(''),
    resumedBy: uuid('resumed_by').notNull(),
    resumedAt: timestamp('resumed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('permit_work_resumes_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('permit_work_resumes_pause_id_idx').on(table.pauseId),
    uniqueIndex('permit_work_resumes_pause_id_unique').on(table.pauseId),
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
