import {
  bigint,
  boolean,
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

export const PERMIT_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'active',
  'suspended',
  'pending_closure',
  'closed',
  'expired',
  'cancelled',
  'rejected',
  'deferred',
] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export const permits = pgTable(
  'permits',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    reference: varchar('reference', { length: 32 }),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    permitTypeId: uuid('permit_type_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    workScope: text('work_scope'),
    plantId: uuid('plant_id'),
    departmentId: uuid('department_id'),
    locationId: uuid('location_id'),
    workstationId: uuid('workstation_id'),
    machineryId: uuid('machinery_id'),
    plannedStartAt: timestamp('planned_start_at', { withTimezone: true }),
    plannedEndAt: timestamp('planned_end_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    submittedBy: uuid('submitted_by'),
  },
  (table) => [
    uniqueIndex('permits_tenant_reference_unique').on(table.tenantId, table.reference),
    index('permits_tenant_id_idx').on(table.tenantId),
    index('permits_status_idx').on(table.status),
    index('permits_tenant_status_idx').on(table.tenantId, table.status),
    index('permits_permit_type_id_idx').on(table.permitTypeId),
  ],
);

export const permitDrafts = pgTable(
  'permit_drafts',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    currentStep: integer('current_step').notNull().default(0),
    formSnapshot: jsonb('form_snapshot').$type<Record<string, unknown>>(),
    lastAutosavedAt: timestamp('last_autosaved_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('permit_drafts_permit_id_unique').on(table.permitId),
  ],
);

export const permitAttachments = pgTable(
  'permit_attachments',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 128 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    storageBucket: varchar('storage_bucket', { length: 128 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    checksum: varchar('checksum', { length: 128 }),
    uploadedBy: uuid('uploaded_by').notNull(),
  },
  (table) => [index('permit_attachments_permit_id_idx').on(table.permitId)],
);

export const permitHazards = pgTable(
  'permit_hazards',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    hazardCategoryId: uuid('hazard_category_id').notNull(),
    description: text('description'),
  },
  (table) => [
    uniqueIndex('permit_hazards_permit_hazard_unique').on(
      table.permitId,
      table.hazardCategoryId,
    ),
    index('permit_hazards_permit_id_idx').on(table.permitId),
  ],
);

export const permitPpe = pgTable(
  'permit_ppe',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    ppeCatalogueId: uuid('ppe_catalogue_id').notNull(),
    quantity: integer('quantity').notNull().default(1),
  },
  (table) => [
    uniqueIndex('permit_ppe_permit_ppe_unique').on(table.permitId, table.ppeCatalogueId),
    index('permit_ppe_permit_id_idx').on(table.permitId),
  ],
);

export const permitExecutors = pgTable(
  'permit_executors',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    workforceUserId: uuid('workforce_user_id').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (table) => [
    uniqueIndex('permit_executors_permit_user_unique').on(
      table.permitId,
      table.workforceUserId,
    ),
    index('permit_executors_permit_id_idx').on(table.permitId),
  ],
);
