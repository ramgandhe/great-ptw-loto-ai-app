import {
  boolean,
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
import { machineryCatalogue, workstationCatalogue } from './master-data';
import { locations } from './organisation';
import { permits } from './permit';

export const SIMOPS_CONFLICT_STATUSES = [
  'detected',
  'pending_assessment',
  'resolved',
  'rejected',
] as const;
export type SimopsConflictStatus = (typeof SIMOPS_CONFLICT_STATUSES)[number];

export const SIMOPS_CONFLICT_SEVERITIES = ['low', 'medium', 'high'] as const;
export type SimopsConflictSeverity = (typeof SIMOPS_CONFLICT_SEVERITIES)[number];

export const SIMOPS_CONFLICT_TYPES = [
  'location',
  'schedule',
  'equipment',
  'permit_type',
  'energy_source',
  'adjacency',
] as const;
export type SimopsConflictType = (typeof SIMOPS_CONFLICT_TYPES)[number];

export const SIMOPS_PARTICIPANT_ROLES = ['newer', 'older', 'peer'] as const;
export type SimopsParticipantRole = (typeof SIMOPS_PARTICIPANT_ROLES)[number];

export const SIMOPS_ALERT_CHANNELS = ['in_app', 'push', 'email'] as const;
export type SimopsAlertChannel = (typeof SIMOPS_ALERT_CHANNELS)[number];

export const SIMOPS_ALERT_DELIVERY_STATUSES = [
  'pending',
  'sent',
  'failed',
  'acknowledged',
] as const;
export type SimopsAlertDeliveryStatus = (typeof SIMOPS_ALERT_DELIVERY_STATUSES)[number];

export const simopsConflicts = pgTable(
  'simops_conflicts',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('detected'),
    severity: varchar('severity', { length: 16 }).notNull(),
    primaryConflictType: varchar('primary_conflict_type', { length: 32 }).notNull(),
    conflictTypes: jsonb('conflict_types').$type<string[]>().notNull(),
    fingerprint: varchar('fingerprint', { length: 128 }).notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    overlapStartAt: timestamp('overlap_start_at', { withTimezone: true }),
    overlapEndAt: timestamp('overlap_end_at', { withTimezone: true }),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
    workstationId: uuid('workstation_id').references(() => workstationCatalogue.id, {
      onDelete: 'set null',
    }),
    machineryId: uuid('machinery_id').references(() => machineryCatalogue.id, {
      onDelete: 'set null',
    }),
    details: jsonb('details').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('simops_conflicts_tenant_id_idx').on(table.tenantId),
    index('simops_conflicts_tenant_status_idx').on(table.tenantId, table.status),
    index('simops_conflicts_tenant_severity_idx').on(table.tenantId, table.severity),
    index('simops_conflicts_detected_at_idx').on(table.detectedAt),
    uniqueIndex('simops_conflicts_tenant_fingerprint_unique').on(
      table.tenantId,
      table.fingerprint,
    ),
  ],
);

export const conflictParticipants = pgTable(
  'conflict_participants',
  {
    ...auditColumns,
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'cascade' }),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'restrict' }),
    participantRole: varchar('participant_role', { length: 16 }).notNull(),
    isFrozen: boolean('is_frozen').notNull().default(false),
  },
  (table) => [
    index('conflict_participants_conflict_id_idx').on(table.conflictId),
    index('conflict_participants_permit_id_idx').on(table.permitId),
    uniqueIndex('conflict_participants_conflict_permit_unique').on(
      table.conflictId,
      table.permitId,
    ),
  ],
);

export const conflictAlerts = pgTable(
  'conflict_alerts',
  {
    ...auditColumns,
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    recipientUserId: uuid('recipient_user_id'),
    recipientRole: varchar('recipient_role', { length: 64 }),
    channel: varchar('channel', { length: 16 }).notNull(),
    deliveryStatus: varchar('delivery_status', { length: 32 }).notNull().default('pending'),
    message: text('message'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (table) => [
    index('conflict_alerts_conflict_id_idx').on(table.conflictId),
    index('conflict_alerts_tenant_delivery_status_idx').on(
      table.tenantId,
      table.deliveryStatus,
    ),
    index('conflict_alerts_recipient_user_id_idx').on(table.recipientUserId),
  ],
);

/** SP-04.02 — Conflict Resolution */

export const SIMOPS_ASSESSMENT_STATUSES = ['draft', 'completed'] as const;
export type SimopsAssessmentStatus = (typeof SIMOPS_ASSESSMENT_STATUSES)[number];

export const SIMOPS_MITIGATION_STATUSES = [
  'draft',
  'active',
  'completed',
  'cancelled',
] as const;
export type SimopsMitigationStatus = (typeof SIMOPS_MITIGATION_STATUSES)[number];

export const SIMOPS_RESOLUTION_DECISIONS = ['approved', 'rejected'] as const;
export type SimopsResolutionDecision = (typeof SIMOPS_RESOLUTION_DECISIONS)[number];

export const SIMOPS_HISTORY_ACTIONS = [
  'detected',
  'assessed',
  'mitigation_created',
  'mitigation_updated',
  'approved',
  'rejected',
  'escalated',
  'notification_sent',
] as const;
export type SimopsHistoryAction = (typeof SIMOPS_HISTORY_ACTIONS)[number];

export type MitigationMeasure = {
  action: string;
  ownerUserId?: string;
  dueAt?: string;
  completed?: boolean;
};

export const conflictAssessments = pgTable(
  'conflict_assessments',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'cascade' }),
    assessedSeverity: varchar('assessed_severity', { length: 16 }).notNull(),
    riskSummary: text('risk_summary'),
    findings: jsonb('findings').$type<Record<string, unknown>>(),
    assessedBy: uuid('assessed_by').notNull(),
    assessedAt: timestamp('assessed_at', { withTimezone: true }).notNull().defaultNow(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
  },
  (table) => [
    index('conflict_assessments_tenant_id_idx').on(table.tenantId),
    index('conflict_assessments_conflict_id_idx').on(table.conflictId),
    index('conflict_assessments_conflict_assessed_at_idx').on(
      table.conflictId,
      table.assessedAt,
    ),
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
    assessmentId: uuid('assessment_id').references(() => conflictAssessments.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    measures: jsonb('measures').$type<MitigationMeasure[]>().notNull().default([]),
    responsibleUserId: uuid('responsible_user_id'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    evidenceStorageBucket: varchar('evidence_storage_bucket', { length: 128 }),
    evidenceStorageKey: varchar('evidence_storage_key', { length: 512 }),
  },
  (table) => [
    index('mitigation_plans_tenant_id_idx').on(table.tenantId),
    index('mitigation_plans_conflict_id_idx').on(table.conflictId),
    index('mitigation_plans_assessment_id_idx').on(table.assessmentId),
    index('mitigation_plans_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const conflictResolutions = pgTable(
  'conflict_resolutions',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'restrict' }),
    decision: varchar('decision', { length: 16 }).notNull(),
    comments: text('comments').notNull(),
    decidedBy: uuid('decided_by').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
    mitigationPlanId: uuid('mitigation_plan_id').references(() => mitigationPlans.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    uniqueIndex('conflict_resolutions_conflict_id_unique').on(table.conflictId),
    index('conflict_resolutions_tenant_id_idx').on(table.tenantId),
    index('conflict_resolutions_tenant_decision_idx').on(table.tenantId, table.decision),
    index('conflict_resolutions_decided_at_idx').on(table.decidedAt),
  ],
);

/** FR-SIM-010 / BR-SIM-011 — append-only conflict workflow history. */
export const conflictHistory = pgTable(
  'conflict_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    conflictId: uuid('conflict_id')
      .notNull()
      .references(() => simopsConflicts.id, { onDelete: 'restrict' }),
    action: varchar('action', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id'),
    actorId: uuid('actor_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('conflict_history_tenant_id_idx').on(table.tenantId),
    index('conflict_history_conflict_id_idx').on(table.conflictId),
    index('conflict_history_tenant_occurred_at_idx').on(table.tenantId, table.occurredAt),
    index('conflict_history_conflict_occurred_at_idx').on(table.conflictId, table.occurredAt),
    index('conflict_history_action_idx').on(table.action),
  ],
);
