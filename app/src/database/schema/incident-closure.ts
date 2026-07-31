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
import { incidents } from './incident';
import { investigations } from './investigation';

export const incidentVerifications = pgTable(
  'incident_verifications',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'restrict' }),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'restrict' }),
    verifiedBy: uuid('verified_by').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
    comments: text('comments').notNull().default(''),
    correctiveActionsConfirmed: boolean('corrective_actions_confirmed').notNull().default(false),
    preventiveActionsReviewed: boolean('preventive_actions_reviewed').notNull().default(false),
  },
  (table) => [
    uniqueIndex('incident_verifications_incident_id_unique').on(table.incidentId),
    index('incident_verifications_tenant_id_idx').on(table.tenantId),
    index('incident_verifications_investigation_id_idx').on(table.investigationId),
  ],
);

export const incidentClosures = pgTable(
  'incident_closures',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'restrict' }),
    verificationId: uuid('verification_id')
      .notNull()
      .references(() => incidentVerifications.id, { onDelete: 'restrict' }),
    closedBy: uuid('closed_by').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }).notNull().defaultNow(),
    comments: text('comments').notNull().default(''),
  },
  (table) => [
    uniqueIndex('incident_closures_incident_id_unique').on(table.incidentId),
    index('incident_closures_tenant_id_idx').on(table.tenantId),
    index('incident_closures_verification_id_idx').on(table.verificationId),
  ],
);

export const incidentArchive = pgTable(
  'incident_archive',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'restrict' }),
    reference: varchar('reference', { length: 64 }).notNull(),
    incidentType: varchar('incident_type', { length: 32 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }).notNull().defaultNow(),
    archivedBy: uuid('archived_by').notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  },
  (table) => [
    uniqueIndex('incident_archive_incident_id_unique').on(table.incidentId),
    uniqueIndex('incident_archive_tenant_reference_unique').on(table.tenantId, table.reference),
    index('incident_archive_tenant_id_idx').on(table.tenantId),
    index('incident_archive_closed_at_idx').on(table.closedAt),
    index('incident_archive_tenant_type_idx').on(table.tenantId, table.incidentType),
  ],
);
