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
import { incidents } from './incident';

export const INVESTIGATION_STATUSES = ['assigned', 'in_progress', 'completed'] as const;
export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

export const ACTION_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ROOT_CAUSE_METHODOLOGIES = [
  '5_why',
  'fishbone',
  'fault_tree',
  'other',
] as const;
export type RootCauseMethodology = (typeof ROOT_CAUSE_METHODOLOGIES)[number];

export const INVESTIGATION_HISTORY_EVENT_TYPES = [
  'assigned',
  'status_changed',
  'root_cause_recorded',
  'corrective_action_created',
  'corrective_action_updated',
  'preventive_action_created',
  'preventive_action_updated',
  'completed',
] as const;
export type InvestigationHistoryEventType =
  (typeof INVESTIGATION_HISTORY_EVENT_TYPES)[number];

export const investigations = pgTable(
  'investigations',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 32 }).notNull().default('assigned'),
    investigatorId: uuid('investigator_id').notNull(),
    assignedBy: uuid('assigned_by').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    dueDate: date('due_date'),
    priority: varchar('priority', { length: 32 }).notNull().default('medium'),
    findings: text('findings').notNull().default(''),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by'),
  },
  (table) => [
    uniqueIndex('investigations_incident_id_unique').on(table.incidentId),
    index('investigations_tenant_id_idx').on(table.tenantId),
    index('investigations_tenant_status_idx').on(table.tenantId, table.status),
    index('investigations_investigator_id_idx').on(table.investigatorId),
  ],
);

export const rootCauses = pgTable(
  'root_causes',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    methodology: varchar('methodology', { length: 32 }).notNull().default('5_why'),
    description: text('description').notNull(),
    recordedBy: uuid('recorded_by').notNull(),
  },
  (table) => [
    index('root_causes_tenant_id_idx').on(table.tenantId),
    index('root_causes_investigation_id_idx').on(table.investigationId),
  ],
);

export const correctiveActions = pgTable(
  'corrective_actions',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    ownerId: uuid('owner_id').notNull(),
    dueDate: date('due_date').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by'),
  },
  (table) => [
    index('corrective_actions_tenant_id_idx').on(table.tenantId),
    index('corrective_actions_investigation_id_idx').on(table.investigationId),
    index('corrective_actions_owner_id_idx').on(table.ownerId),
    index('corrective_actions_status_due_idx').on(table.status, table.dueDate),
  ],
);

export const preventiveActions = pgTable(
  'preventive_actions',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    ownerId: uuid('owner_id').notNull(),
    dueDate: date('due_date'),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: uuid('completed_by'),
  },
  (table) => [
    index('preventive_actions_tenant_id_idx').on(table.tenantId),
    index('preventive_actions_investigation_id_idx').on(table.investigationId),
    index('preventive_actions_owner_id_idx').on(table.ownerId),
  ],
);

export const investigationHistory = pgTable(
  'investigation_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'restrict' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    actorId: uuid('actor_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('investigation_history_tenant_id_idx').on(table.tenantId),
    index('investigation_history_investigation_id_idx').on(table.investigationId),
    index('investigation_history_incident_created_at_idx').on(
      table.incidentId,
      table.createdAt,
    ),
  ],
);
