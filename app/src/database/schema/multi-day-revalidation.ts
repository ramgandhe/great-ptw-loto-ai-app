import {
  boolean,
  date,
  index,
  integer,
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

export const REVALIDATION_OUTCOMES = ['passed', 'failed'] as const;
export type RevalidationOutcome = (typeof REVALIDATION_OUTCOMES)[number];

export const EXTENSION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ExtensionStatus = (typeof EXTENSION_STATUSES)[number];

export const REVALIDATION_HISTORY_EVENT_TYPES = [
  'revalidation_passed',
  'revalidation_failed',
  'permit_continued',
  'permit_suspended',
  'extension_requested',
  'extension_approved',
  'extension_rejected',
  'validity_checked',
  'renewal_created',
  'renewal_accepted',
  'renewal_rejected',
] as const;
export type RevalidationHistoryEventType = (typeof REVALIDATION_HISTORY_EVENT_TYPES)[number];

export const VALIDITY_DECISIONS = [
  'ok_gt_48h',
  'renew_notify_lte_48h',
  'expired',
  'out_of_range',
] as const;
export type ValidityDecision = (typeof VALIDITY_DECISIONS)[number];

export const RENEWAL_STATUSES = [
  'draft',
  'pending_approval',
  'accepted',
  'rejected',
] as const;
export type RenewalStatus = (typeof RENEWAL_STATUSES)[number];

export const permitValidityChecks = pgTable(
  'permit_validity_checks',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    operationalDate: date('operational_date').notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull(),
    decision: varchar('decision', { length: 32 }).notNull(),
    remainingHours: integer('remaining_hours'),
    plannedEndAt: timestamp('planned_end_at', { withTimezone: true }),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    revalidationRequired: boolean('revalidation_required').notNull().default(false),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex('permit_validity_checks_tenant_permit_day_unique').on(
      table.tenantId,
      table.permitId,
      table.operationalDate,
    ),
    index('permit_validity_checks_tenant_decision_idx').on(table.tenantId, table.decision),
  ],
);

export const permitRenewals = pgTable(
  'permit_renewals',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    sourcePermitId: uuid('source_permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    renewalPermitId: uuid('renewal_permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    requestedBy: uuid('requested_by').notNull(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionComments: text('decision_comments'),
  },
  (table) => [
    uniqueIndex('permit_renewals_renewal_permit_unique').on(table.renewalPermitId),
    index('permit_renewals_source_permit_idx').on(table.sourcePermitId),
    index('permit_renewals_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const permitRevalidations = pgTable(
  'permit_revalidations',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    operationalDate: date('operational_date').notNull(),
    outcome: varchar('outcome', { length: 16 }).notNull(),
    checklist: jsonb('checklist').$type<Record<string, unknown>>(),
    findings: text('findings').notNull(),
    revalidatedBy: uuid('revalidated_by').notNull(),
    revalidatedAt: timestamp('revalidated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_revalidations_tenant_permit_day_unique').on(
      table.tenantId,
      table.permitId,
      table.operationalDate,
    ),
    index('permit_revalidations_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('permit_revalidations_permit_day_idx').on(table.permitId, table.operationalDate),
  ],
);

export const permitExtensions = pgTable(
  'permit_extensions',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    requestedEndAt: timestamp('requested_end_at', { withTimezone: true }).notNull(),
    previousEndAt: timestamp('previous_end_at', { withTimezone: true }),
    justification: text('justification').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    requestedBy: uuid('requested_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionComments: text('decision_comments'),
  },
  (table) => [
    index('permit_extensions_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('permit_extensions_status_idx').on(table.status),
  ],
);

export const permitSuspensions = pgTable(
  'permit_suspensions',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    suspendedBy: uuid('suspended_by').notNull(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }).notNull().defaultNow(),
    resumedBy: uuid('resumed_by'),
    resumedAt: timestamp('resumed_at', { withTimezone: true }),
    source: varchar('source', { length: 32 }).notNull().default('manual'),
  },
  (table) => [
    index('permit_suspensions_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('permit_suspensions_permit_suspended_at_idx').on(table.permitId, table.suspendedAt),
  ],
);

export const revalidationHistory = pgTable(
  'revalidation_history',
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
    index('revalidation_history_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('revalidation_history_permit_created_at_idx').on(table.permitId, table.createdAt),
  ],
);
