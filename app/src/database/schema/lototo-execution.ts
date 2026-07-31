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
import { isolationPoints, lototoPlans } from './lototo';

export const ISOLATION_EXECUTION_STATUSES = [
  'in_progress',
  'isolated',
  'verified',
  'restored',
] as const;
export type IsolationExecutionStatus = (typeof ISOLATION_EXECUTION_STATUSES)[number];

export const APPLIED_LOCK_STATUSES = ['applied', 'removed'] as const;
export type AppliedLockStatus = (typeof APPLIED_LOCK_STATUSES)[number];

export const APPLIED_TAG_STATUSES = ['applied', 'removed'] as const;
export type AppliedTagStatus = (typeof APPLIED_TAG_STATUSES)[number];

export const ISOLATION_VERIFICATION_RESULTS = ['pass', 'fail'] as const;
export type IsolationVerificationResult = (typeof ISOLATION_VERIFICATION_RESULTS)[number];

// FR-LTO-008/011 — execution instance of a LOTOTO plan with activity timestamps.
export const isolationExecution = pgTable(
  'isolation_execution',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => lototoPlans.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).notNull().default('in_progress'),
    startedBy: uuid('started_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    isolatedAt: timestamp('isolated_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    restoredAt: timestamp('restored_at', { withTimezone: true }),
    restoredBy: uuid('restored_by'),
  },
  (table) => [
    uniqueIndex('isolation_execution_plan_id_unique').on(table.planId),
    index('isolation_execution_tenant_id_idx').on(table.tenantId),
    index('isolation_execution_tenant_status_idx').on(table.tenantId, table.status),
    index('isolation_execution_started_by_idx').on(table.startedBy),
  ],
);

// FR-LTO-006/010/011 — lock registry: lockout method + personnel + timestamps.
export const appliedLocks = pgTable(
  'applied_locks',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => isolationExecution.id, { onDelete: 'cascade' }),
    isolationPointId: uuid('isolation_point_id')
      .notNull()
      .references(() => isolationPoints.id, { onDelete: 'restrict' }),
    lockTag: varchar('lock_tag', { length: 64 }).notNull(),
    lockMethod: varchar('lock_method', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('applied'),
    appliedBy: uuid('applied_by').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    removedBy: uuid('removed_by'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (table) => [
    index('applied_locks_tenant_id_idx').on(table.tenantId),
    index('applied_locks_execution_id_idx').on(table.executionId),
    index('applied_locks_isolation_point_id_idx').on(table.isolationPointId),
    uniqueIndex('applied_locks_execution_point_tag_unique').on(
      table.executionId,
      table.isolationPointId,
      table.lockTag,
    ),
  ],
);

// FR-LTO-008/010/011 — tag registry: tag details + personnel + timestamps.
export const appliedTags = pgTable(
  'applied_tags',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => isolationExecution.id, { onDelete: 'cascade' }),
    isolationPointId: uuid('isolation_point_id')
      .notNull()
      .references(() => isolationPoints.id, { onDelete: 'restrict' }),
    tagNumber: varchar('tag_number', { length: 64 }).notNull(),
    tagType: varchar('tag_type', { length: 64 }).notNull(),
    reason: text('reason'),
    status: varchar('status', { length: 32 }).notNull().default('applied'),
    appliedBy: uuid('applied_by').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    removedBy: uuid('removed_by'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (table) => [
    index('applied_tags_tenant_id_idx').on(table.tenantId),
    index('applied_tags_execution_id_idx').on(table.executionId),
    index('applied_tags_isolation_point_id_idx').on(table.isolationPointId),
    uniqueIndex('applied_tags_execution_point_number_unique').on(
      table.executionId,
      table.isolationPointId,
      table.tagNumber,
    ),
  ],
);

// FR-LTO-007/010/011 — verification records (immutable audit).
export const isolationVerifications = pgTable(
  'isolation_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => isolationExecution.id, { onDelete: 'cascade' }),
    isolationPointId: uuid('isolation_point_id')
      .notNull()
      .references(() => isolationPoints.id, { onDelete: 'restrict' }),
    result: varchar('result', { length: 32 }).notNull(),
    method: varchar('method', { length: 64 }),
    verifiedBy: uuid('verified_by').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
    comment: text('comment'),
  },
  (table) => [
    index('isolation_verifications_tenant_id_idx').on(table.tenantId),
    index('isolation_verifications_execution_id_idx').on(table.executionId),
    index('isolation_verifications_isolation_point_id_idx').on(table.isolationPointId),
    index('isolation_verifications_verified_by_idx').on(table.verifiedBy),
  ],
);

// FR-LTO-009/010/011 — isolation evidence (immutable, stored in MinIO).
export const isolationEvidence = pgTable(
  'isolation_evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => isolationExecution.id, { onDelete: 'cascade' }),
    isolationPointId: uuid('isolation_point_id').references(() => isolationPoints.id, {
      onDelete: 'set null',
    }),
    verificationId: uuid('verification_id').references(() => isolationVerifications.id, {
      onDelete: 'set null',
    }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 128 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    storageBucket: varchar('storage_bucket', { length: 128 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    checksum: varchar('checksum', { length: 128 }),
    capturedBy: uuid('captured_by').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('isolation_evidence_tenant_id_idx').on(table.tenantId),
    index('isolation_evidence_execution_id_idx').on(table.executionId),
    index('isolation_evidence_isolation_point_id_idx').on(table.isolationPointId),
    index('isolation_evidence_verification_id_idx').on(table.verificationId),
    uniqueIndex('isolation_evidence_storage_key_unique').on(
      table.storageBucket,
      table.storageKey,
    ),
  ],
);
