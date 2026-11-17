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

export const REVALIDATION_OUTCOMES = ['passed', 'failed'] as const;
export type RevalidationOutcome = (typeof REVALIDATION_OUTCOMES)[number];

export const EXTENSION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ExtensionStatus = (typeof EXTENSION_STATUSES)[number];

export const REVALIDATION_HISTORY_EVENT_TYPES = [
  'revalidation_passed',
  'revalidation_failed',
  'permit_continued',
  'permit_cleared',
  'permit_suspended',
  'extension_requested',
  'extension_approved',
  'extension_rejected',
  'overtime_requested',
  'overtime_approved',
  'overtime_rejected',
  'override_used',
  'day_secured',
  'late_secure_recorded',
  'validity_expired',
  'renewal_due_notified',
  'max_validity_due_notified',
  'renewal_initiated',
  'clear_day_expired',
  'failed_reopen',
  'secure_due_reminder',
  'reopen_due_reminder',
  'late_secure_reminder',
  'evidence_uploaded',
] as const;
export type RevalidationHistoryEventType = (typeof REVALIDATION_HISTORY_EVENT_TYPES)[number];

export const OVERTIME_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type OvertimeStatus = (typeof OVERTIME_STATUSES)[number];

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

/** Same-day overtime (past operational-day cut-off; not a multi-day duration extension). */
export const permitOvertimeRequests = pgTable(
  'permit_overtime_requests',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    operationalDate: date('operational_date').notNull(),
    requestedUntil: timestamp('requested_until', { withTimezone: true }).notNull(),
    justification: text('justification').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    requestedBy: uuid('requested_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionComments: text('decision_comments'),
  },
  (table) => [
    index('permit_overtime_requests_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('permit_overtime_requests_status_idx').on(table.status),
    index('permit_overtime_requests_permit_day_idx').on(table.permitId, table.operationalDate),
  ],
);

/** Day-scoped emergency override of the daily reopen hard gate. */
export const permitMdpOverrides = pgTable(
  'permit_mdp_overrides',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    operationalDate: date('operational_date').notNull(),
    reason: text('reason').notNull(),
    overriddenBy: uuid('overridden_by').notNull(),
    overriddenAt: timestamp('overridden_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_mdp_overrides_tenant_permit_day_unique').on(
      table.tenantId,
      table.permitId,
      table.operationalDate,
    ),
    index('permit_mdp_overrides_tenant_permit_idx').on(table.tenantId, table.permitId),
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
