import {
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
import { appliedLocks, appliedTags, isolationExecution } from './lototo-execution';
import { isolationPoints } from './lototo';

export const RESTORATION_STATUSES = ['pending', 'restored'] as const;
export type RestorationStatus = (typeof RESTORATION_STATUSES)[number];

export const RESTORATION_VERIFICATION_RESULTS = ['pass', 'fail'] as const;
export type RestorationVerificationResult =
  (typeof RESTORATION_VERIFICATION_RESULTS)[number];

// FR-LTO-012 — controlled restoration of an isolation point after work completes.
export const equipmentRestorations = pgTable(
  'equipment_restorations',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => isolationExecution.id, { onDelete: 'cascade' }),
    isolationPointId: uuid('isolation_point_id')
      .notNull()
      .references(() => isolationPoints.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 32 }).notNull().default('restored'),
    method: varchar('method', { length: 64 }),
    notes: text('notes'),
    restoredBy: uuid('restored_by').notNull(),
    restoredAt: timestamp('restored_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('equipment_restorations_tenant_id_idx').on(table.tenantId),
    index('equipment_restorations_execution_id_idx').on(table.executionId),
    index('equipment_restorations_isolation_point_id_idx').on(table.isolationPointId),
    uniqueIndex('equipment_restorations_execution_point_unique').on(
      table.executionId,
      table.isolationPointId,
    ),
  ],
);

// FR-LTO-012 — immutable record of a lock removed during restoration.
export const lockRemovals = pgTable(
  'lock_removals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => isolationExecution.id, { onDelete: 'cascade' }),
    appliedLockId: uuid('applied_lock_id')
      .notNull()
      .references(() => appliedLocks.id, { onDelete: 'restrict' }),
    reason: text('reason'),
    removedBy: uuid('removed_by').notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('lock_removals_tenant_id_idx').on(table.tenantId),
    index('lock_removals_execution_id_idx').on(table.executionId),
    uniqueIndex('lock_removals_applied_lock_id_unique').on(table.appliedLockId),
  ],
);

// FR-LTO-012 — immutable record of a tag removed during restoration.
export const tagRemovals = pgTable(
  'tag_removals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => isolationExecution.id, { onDelete: 'cascade' }),
    appliedTagId: uuid('applied_tag_id')
      .notNull()
      .references(() => appliedTags.id, { onDelete: 'restrict' }),
    reason: text('reason'),
    removedBy: uuid('removed_by').notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('tag_removals_tenant_id_idx').on(table.tenantId),
    index('tag_removals_execution_id_idx').on(table.executionId),
    uniqueIndex('tag_removals_applied_tag_id_unique').on(table.appliedTagId),
  ],
);

// FR-LTO-012 — immutable verification that restoration was performed safely.
export const restorationVerifications = pgTable(
  'restoration_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => isolationExecution.id, { onDelete: 'cascade' }),
    restorationId: uuid('restoration_id').references(() => equipmentRestorations.id, {
      onDelete: 'set null',
    }),
    isolationPointId: uuid('isolation_point_id').references(() => isolationPoints.id, {
      onDelete: 'restrict',
    }),
    result: varchar('result', { length: 32 }).notNull(),
    method: varchar('method', { length: 64 }),
    verifiedBy: uuid('verified_by').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
    comment: text('comment'),
  },
  (table) => [
    index('restoration_verifications_tenant_id_idx').on(table.tenantId),
    index('restoration_verifications_execution_id_idx').on(table.executionId),
    index('restoration_verifications_restoration_id_idx').on(table.restorationId),
  ],
);

// FR-LTO-013 / FR-LTO-014 — append-only history of every LOTOTO activity.
export const lototoHistory = pgTable(
  'lototo_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    planId: uuid('plan_id'),
    executionId: uuid('execution_id'),
    action: varchar('action', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id'),
    actorId: uuid('actor_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('lototo_history_tenant_id_idx').on(table.tenantId),
    index('lototo_history_plan_id_idx').on(table.planId),
    index('lototo_history_execution_id_idx').on(table.executionId),
    index('lototo_history_tenant_occurred_at_idx').on(table.tenantId, table.occurredAt),
    index('lototo_history_plan_occurred_at_idx').on(table.planId, table.occurredAt),
  ],
);
