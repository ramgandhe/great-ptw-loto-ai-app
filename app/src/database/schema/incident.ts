import {
  bigint,
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
import { machineryCatalogue } from './master-data';
import { permits } from './permit';

export const INCIDENT_TYPES = ['incident', 'near_miss', 'unsafe_condition'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

/** FR-INC-011: structurally different severity paths. */
export const INCIDENT_SEVERITY_PATHS = ['near_miss', 'accident'] as const;
export type IncidentSeverityPath = (typeof INCIDENT_SEVERITY_PATHS)[number];

export const INCIDENT_STATUSES = [
  'draft',
  'open',
  'investigating',
  'pending_verification',
  'verified',
  'closed',
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];

/** FR-INC-011 near-miss HOD decision outcomes. */
export const NEAR_MISS_HOD_DECISIONS = ['continue', 'stop'] as const;
export type NearMissHodDecision = (typeof NEAR_MISS_HOD_DECISIONS)[number];

/**
 * Structural lifecycle states — distinct from investigation/closure statuses.
 * Near-miss awaits HOD; accident is auto-terminated without HOD continue/stop.
 */
export const INCIDENT_LIFECYCLE_STATUSES = [
  'awaiting_hod',
  'continued',
  'stopped',
  'auto_terminated',
] as const;
export type IncidentLifecycleStatus = (typeof INCIDENT_LIFECYCLE_STATUSES)[number];

export const INCIDENT_LIFECYCLE_EVENT_TYPES = [
  'path_opened',
  'hod_continue',
  'hod_stop',
  'accident_auto_terminated',
  'permit_cancelled',
] as const;
export type IncidentLifecycleEventType = (typeof INCIDENT_LIFECYCLE_EVENT_TYPES)[number];

export const incidents = pgTable(
  'incidents',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    reference: varchar('reference', { length: 64 }).notNull(),
    incidentType: varchar('incident_type', { length: 32 }).notNull(),
    severityPath: varchar('severity_path', { length: 32 }).notNull().default('near_miss'),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    locationDescription: text('location_description').notNull().default(''),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    priority: varchar('priority', { length: 32 }).notNull().default('medium'),
    reportedBy: uuid('reported_by').notNull(),
    submittedBy: uuid('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    plantId: uuid('plant_id'),
    locationId: uuid('location_id'),
    workstationId: uuid('workstation_id'),
  },
  (table) => [
    uniqueIndex('incidents_tenant_reference_unique').on(table.tenantId, table.reference),
    index('incidents_tenant_id_idx').on(table.tenantId),
    index('incidents_tenant_status_idx').on(table.tenantId, table.status),
    index('incidents_tenant_type_idx').on(table.tenantId, table.incidentType),
    index('incidents_occurred_at_idx').on(table.occurredAt),
  ],
);

export const incidentEvidence = pgTable(
  'incident_evidence',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'restrict' }),
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
    index('incident_evidence_tenant_id_idx').on(table.tenantId),
    index('incident_evidence_incident_id_idx').on(table.incidentId),
    uniqueIndex('incident_evidence_storage_key_unique').on(table.tenantId, table.storageKey),
  ],
);

export const incidentEquipment = pgTable(
  'incident_equipment',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    machineryId: uuid('machinery_id')
      .notNull()
      .references(() => machineryCatalogue.id, { onDelete: 'restrict' }),
  },
  (table) => [
    uniqueIndex('incident_equipment_incident_machinery_unique').on(
      table.incidentId,
      table.machineryId,
    ),
    index('incident_equipment_tenant_id_idx').on(table.tenantId),
    index('incident_equipment_incident_id_idx').on(table.incidentId),
    index('incident_equipment_machinery_id_idx').on(table.machineryId),
  ],
);

export const incidentPermits = pgTable(
  'incident_permits',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'restrict' }),
  },
  (table) => [
    uniqueIndex('incident_permits_incident_permit_unique').on(table.incidentId, table.permitId),
    index('incident_permits_tenant_id_idx').on(table.tenantId),
    index('incident_permits_incident_id_idx').on(table.incidentId),
    index('incident_permits_permit_id_idx').on(table.permitId),
  ],
);

/** FR-INC-011 — one structural lifecycle row per incident (near-miss vs accident paths). */
export const incidentSeverityLifecycle = pgTable(
  'incident_severity_lifecycle',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    severityPath: varchar('severity_path', { length: 32 }).notNull(),
    lifecycleStatus: varchar('lifecycle_status', { length: 32 }).notNull(),
    hodDecision: varchar('hod_decision', { length: 16 }),
    hodDecidedBy: uuid('hod_decided_by'),
    hodDecidedAt: timestamp('hod_decided_at', { withTimezone: true }),
    hodDecisionComments: text('hod_decision_comments'),
    /** Idempotency marker for accident auto-termination / near-miss stop permit cancel. */
    permitsCancelledAt: timestamp('permits_cancelled_at', { withTimezone: true }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('incident_severity_lifecycle_incident_unique').on(table.incidentId),
    index('incident_severity_lifecycle_tenant_status_idx').on(
      table.tenantId,
      table.lifecycleStatus,
    ),
  ],
);

/** Immutable FR-INC-011 severity lifecycle audit trail. */
export const incidentSeverityHistory = pgTable(
  'incident_severity_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    tenantId: uuid('tenant_id').notNull(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    actorId: uuid('actor_id').notNull(),
    permitId: uuid('permit_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('incident_severity_history_tenant_incident_idx').on(table.tenantId, table.incidentId),
    index('incident_severity_history_incident_created_at_idx').on(
      table.incidentId,
      table.createdAt,
    ),
  ],
);
