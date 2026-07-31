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
