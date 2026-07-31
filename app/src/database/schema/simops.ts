import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { permits } from './permit';

export const CONFLICT_STATUSES = [
  'open',
  'assessed',
  'mitigation_planned',
  'approved',
  'rejected',
] as const;
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];

export const CONFLICT_SEVERITIES = ['low', 'medium', 'high'] as const;
export type ConflictSeverity = (typeof CONFLICT_SEVERITIES)[number];

export const CONFLICT_TYPES = ['location', 'equipment', 'schedule', 'permit_type'] as const;
export type ConflictType = (typeof CONFLICT_TYPES)[number];

export const simopsConflicts = pgTable(
  'simops_conflicts',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    severity: varchar('severity', { length: 16 }).notNull(),
    conflictType: varchar('conflict_type', { length: 32 }).notNull(),
    summary: varchar('summary', { length: 512 }).notNull(),
    details: jsonb('details').$type<Record<string, unknown>>(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    fingerprint: varchar('fingerprint', { length: 128 }).notNull(),
  },
  (table) => [
    index('simops_conflicts_tenant_id_idx').on(table.tenantId),
    index('simops_conflicts_tenant_status_idx').on(table.tenantId, table.status),
    index('simops_conflicts_severity_idx').on(table.severity),
    uniqueIndex('simops_conflicts_tenant_fingerprint_unique').on(table.tenantId, table.fingerprint),
  ],
);

export const conflictParticipants = pgTable(
  'conflict_participants',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'cascade' }),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('conflict_participants_conflict_id_idx').on(table.conflictId),
    index('conflict_participants_permit_id_idx').on(table.permitId),
    uniqueIndex('conflict_participants_conflict_permit_unique').on(table.conflictId, table.permitId),
  ],
);

export const conflictAlerts = pgTable(
  'conflict_alerts',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'cascade' }),
    severity: varchar('severity', { length: 16 }).notNull(),
    message: text('message').notNull(),
    channel: varchar('channel', { length: 32 }).notNull().default('in_app'),
    recipientRole: varchar('recipient_role', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (table) => [
    index('conflict_alerts_tenant_id_idx').on(table.tenantId),
    index('conflict_alerts_conflict_id_idx').on(table.conflictId),
    index('conflict_alerts_status_idx').on(table.status),
  ],
);

export const conflictAssessments = pgTable(
  'conflict_assessments',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'cascade' }),
    assessedSeverity: varchar('assessed_severity', { length: 16 }).notNull(),
    riskSummary: text('risk_summary').notNull(),
    assessedBy: uuid('assessed_by').notNull(),
    assessedAt: timestamp('assessed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('conflict_assessments_conflict_id_unique').on(table.conflictId),
    index('conflict_assessments_tenant_id_idx').on(table.tenantId),
  ],
);

export const mitigationPlans = pgTable(
  'mitigation_plans',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'cascade' }),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => conflictAssessments.id, { onDelete: 'cascade' }),
    planSummary: text('plan_summary').notNull(),
    actions: jsonb('actions').$type<
      Array<{
        description: string;
        assigneeUserId?: string;
        dueAt?: string;
      }>
    >(),
  },
  (table) => [
    uniqueIndex('mitigation_plans_conflict_id_unique').on(table.conflictId),
    index('mitigation_plans_tenant_id_idx').on(table.tenantId),
  ],
);

export const conflictResolutions = pgTable(
  'conflict_resolutions',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'cascade' }),
    outcome: varchar('outcome', { length: 16 }).notNull(),
    comments: text('comments').notNull(),
    resolvedBy: uuid('resolved_by').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('conflict_resolutions_conflict_id_unique').on(table.conflictId),
    index('conflict_resolutions_tenant_id_idx').on(table.tenantId),
    index('conflict_resolutions_outcome_idx').on(table.outcome),
  ],
);

export const conflictHistory = pgTable(
  'conflict_history',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 64 }).notNull(),
    actorUserId: uuid('actor_user_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('conflict_history_conflict_id_idx').on(table.conflictId),
    index('conflict_history_tenant_id_idx').on(table.tenantId),
    index('conflict_history_action_idx').on(table.action),
  ],
);
