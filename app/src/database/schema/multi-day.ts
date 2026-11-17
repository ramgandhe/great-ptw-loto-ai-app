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

export const DAILY_PROGRESS_STATUSES = ['draft', 'submitted'] as const;
export type DailyProgressStatus = (typeof DAILY_PROGRESS_STATUSES)[number];

/** `submitted` retained for legacy rows migrated to accepted. */
export const HANDOVER_STATUSES = [
  'pending_acceptance',
  'accepted',
  'rejected',
  'cancelled',
  'submitted',
] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

/** `pending_countersign` when dual sign required; `submitted` when fully secured. */
export const DAY_SECURE_STATUSES = ['pending_countersign', 'submitted'] as const;
export type DaySecureStatus = (typeof DAY_SECURE_STATUSES)[number];

export const DAILY_ACTIVITY_EVENT_TYPES = [
  'progress_recorded',
  'progress_submitted',
  'handover_completed',
  'handover_accepted',
  'handover_rejected',
  'handover_cancelled',
  'day_secured',
  'late_secure_recorded',
  'day_secure_countersigned',
  'evidence_uploaded',
  'toolbox_talk_recorded',
  'daily_crew_updated',
] as const;

export const DAILY_CREW_ROLES = ['primary', 'substitute'] as const;
export type DailyCrewRole = (typeof DAILY_CREW_ROLES)[number];
export type DailyActivityEventType = (typeof DAILY_ACTIVITY_EVENT_TYPES)[number];

/** FR-MDP-007 / Slice I3–I4: MinIO-backed evidence for progress, secure, reopen. */
export const MDP_EVIDENCE_KINDS = ['daily_progress', 'day_secure', 'reopen'] as const;
export type MdpEvidenceKind = (typeof MDP_EVIDENCE_KINDS)[number];

export const permitDailyProgress = pgTable(
  'permit_daily_progress',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    operationalDate: date('operational_date').notNull(),
    completedWork: text('completed_work').notNull(),
    pendingWork: text('pending_work').notNull().default(''),
    summary: text('summary').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    recordedBy: uuid('recorded_by').notNull(),
    submittedBy: uuid('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    attachmentMeta: jsonb('attachment_meta').$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex('permit_daily_progress_tenant_permit_day_unique').on(
      table.tenantId,
      table.permitId,
      table.operationalDate,
    ),
    index('permit_daily_progress_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('permit_daily_progress_permit_day_idx').on(table.permitId, table.operationalDate),
  ],
);

export const shiftHandovers = pgTable(
  'shift_handovers',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    dailyProgressId: uuid('daily_progress_id').references(() => permitDailyProgress.id, {
      onDelete: 'set null',
    }),
    outgoingUserId: uuid('outgoing_user_id').notNull(),
    incomingUserId: uuid('incoming_user_id').notNull(),
    completedActivities: text('completed_activities').notNull(),
    outstandingWork: text('outstanding_work').notNull(),
    safetyObservations: text('safety_observations').notNull().default(''),
    handedOverAt: timestamp('handed_over_at', { withTimezone: true }).notNull().defaultNow(),
    status: varchar('status', { length: 32 }).notNull().default('pending_acceptance'),
    acceptedBy: uuid('accepted_by'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptanceNotes: text('acceptance_notes').notNull().default(''),
  },
  (table) => [
    index('shift_handovers_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('shift_handovers_permit_handed_over_at_idx').on(table.permitId, table.handedOverAt),
    index('shift_handovers_daily_progress_id_idx').on(table.dailyProgressId),
    index('shift_handovers_status_idx').on(table.status),
  ],
);

/** End-of-day / overnight secure for a multi-day permit operational day. */
export const permitDaySecures = pgTable(
  'permit_day_secures',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    operationalDate: date('operational_date').notNull(),
    checklist: jsonb('checklist').$type<Record<string, unknown>>().notNull().default({}),
    notes: text('notes').notNull().default(''),
    personnelCleared: boolean('personnel_cleared').notNull().default(false),
    late: boolean('late').notNull().default(false),
    lateReason: text('late_reason'),
    securedBy: uuid('secured_by').notNull(),
    securedAt: timestamp('secured_at', { withTimezone: true }).notNull().defaultNow(),
    countersignedBy: uuid('countersigned_by'),
    countersignedAt: timestamp('countersigned_at', { withTimezone: true }),
    status: varchar('status', { length: 32 }).notNull().default('submitted'),
  },
  (table) => [
    uniqueIndex('permit_day_secures_tenant_permit_day_unique').on(
      table.tenantId,
      table.permitId,
      table.operationalDate,
    ),
    index('permit_day_secures_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('permit_day_secures_permit_day_idx').on(table.permitId, table.operationalDate),
  ],
);

export const mdpEvidence = pgTable(
  'mdp_evidence',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 32 }).notNull(),
    operationalDate: date('operational_date'),
    dailyProgressId: uuid('daily_progress_id').references(() => permitDailyProgress.id, {
      onDelete: 'set null',
    }),
    daySecureId: uuid('day_secure_id').references(() => permitDaySecures.id, {
      onDelete: 'set null',
    }),
    revalidationId: uuid('revalidation_id'),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 128 }).notNull(),
    fileSize: integer('file_size').notNull(),
    storageBucket: varchar('storage_bucket', { length: 128 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    comment: text('comment'),
    uploadedBy: uuid('uploaded_by').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('mdp_evidence_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('mdp_evidence_permit_kind_idx').on(table.permitId, table.kind),
    index('mdp_evidence_daily_progress_id_idx').on(table.dailyProgressId),
    index('mdp_evidence_day_secure_id_idx').on(table.daySecureId),
  ],
);

export const dailyActivityHistory = pgTable(
  'daily_activity_history',
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
    index('daily_activity_history_tenant_permit_idx').on(table.tenantId, table.permitId),
    index('daily_activity_history_permit_created_at_idx').on(table.permitId, table.createdAt),
  ],
);

/** Wave 2 C8: one toolbox talk record per permit operational day. */
export const permitToolboxTalks = pgTable(
  'permit_toolbox_talks',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    operationalDate: date('operational_date').notNull(),
    topic: text('topic').notNull(),
    conductedBy: uuid('conducted_by').notNull(),
    attendeeUserIds: jsonb('attendee_user_ids').$type<string[]>().notNull().default([]),
    notes: text('notes').notNull().default(''),
    conductedAt: timestamp('conducted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_toolbox_talks_tenant_permit_day_unique').on(
      table.tenantId,
      table.permitId,
      table.operationalDate,
    ),
    index('permit_toolbox_talks_tenant_permit_idx').on(table.tenantId, table.permitId),
  ],
);

/** Wave 2 D5/D7: authorised workers (and substitutes) for an operational day. */
export const permitDailyCrew = pgTable(
  'permit_daily_crew',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    operationalDate: date('operational_date').notNull(),
    workforceUserId: uuid('workforce_user_id').notNull(),
    role: varchar('role', { length: 32 }).notNull().default('primary'),
    substituteForUserId: uuid('substitute_for_user_id'),
    notes: text('notes').notNull().default(''),
  },
  (table) => [
    uniqueIndex('permit_daily_crew_tenant_permit_day_user_unique').on(
      table.tenantId,
      table.permitId,
      table.operationalDate,
      table.workforceUserId,
    ),
    index('permit_daily_crew_tenant_permit_day_idx').on(
      table.tenantId,
      table.permitId,
      table.operationalDate,
    ),
  ],
);
