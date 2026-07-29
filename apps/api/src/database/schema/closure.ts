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
import { permits } from './permit';

export type VerificationChecklist = {
  workCompleted: boolean;
  evidenceReviewed: boolean;
  areaSecured: boolean;
  hazardsRemoved: boolean;
};

export const permitVerifications = pgTable(
  'permit_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    verifiedBy: uuid('verified_by').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
    comment: text('comment'),
    checklist: jsonb('checklist').$type<VerificationChecklist>().notNull(),
  },
  (table) => [
    uniqueIndex('permit_verifications_permit_id_unique').on(table.permitId),
    index('permit_verifications_verified_by_idx').on(table.verifiedBy),
  ],
);

export const permitClosures = pgTable(
  'permit_closures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    closedBy: uuid('closed_by').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }).notNull().defaultNow(),
    actualEndAt: timestamp('actual_end_at', { withTimezone: true }).notNull(),
    comment: text('comment'),
  },
  (table) => [
    uniqueIndex('permit_closures_permit_id_unique').on(table.permitId),
    index('permit_closures_closed_by_idx').on(table.closedBy),
  ],
);

export const permitArchive = pgTable(
  'permit_archive',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    reference: varchar('reference', { length: 32 }),
    closedAt: timestamp('closed_at', { withTimezone: true }).notNull(),
    closedBy: uuid('closed_by').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_archive_permit_id_unique').on(table.permitId),
    index('permit_archive_tenant_id_idx').on(table.tenantId),
    index('permit_archive_tenant_closed_at_idx').on(table.tenantId, table.closedAt),
    index('permit_archive_tenant_title_idx').on(table.tenantId, table.title),
    index('permit_archive_tenant_reference_idx').on(table.tenantId, table.reference),
  ],
);

export const auditHistory = pgTable(
  'audit_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 64 }).notNull(),
    actorId: uuid('actor_id').notNull(),
    comment: text('comment'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('audit_history_permit_id_idx').on(table.permitId),
    index('audit_history_permit_created_at_idx').on(table.permitId, table.createdAt),
    index('audit_history_actor_id_idx').on(table.actorId),
  ],
);
