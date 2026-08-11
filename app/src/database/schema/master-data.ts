import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';

export const CHECKLIST_STATUSES = ['draft', 'published'] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const IMPORT_JOB_STATUSES = [
  'pending',
  'validating',
  'processing',
  'completed',
  'failed',
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

export const permitTypes = pgTable(
  'permit_types',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    defaultAttributes: jsonb('default_attributes').$type<Record<string, unknown>>(),
    /** FR-PTW-017 — configurable risk classification per permit type. */
    riskClassification: varchar('risk_classification', { length: 16 }).notNull().default('medium'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('permit_types_tenant_code_unique').on(table.tenantId, table.code),
    index('permit_types_tenant_id_idx').on(table.tenantId),
  ],
);

export const ppeCatalogue = pgTable(
  'ppe_catalogue',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 128 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('ppe_catalogue_tenant_code_unique').on(table.tenantId, table.code),
    index('ppe_catalogue_tenant_id_idx').on(table.tenantId),
    index('ppe_catalogue_tenant_category_idx').on(table.tenantId, table.category),
  ],
);

export const workstationCatalogue = pgTable(
  'workstation_catalogue',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('workstation_catalogue_tenant_code_unique').on(table.tenantId, table.code),
    index('workstation_catalogue_tenant_id_idx').on(table.tenantId),
  ],
);

export const machineryCatalogue = pgTable(
  'machinery_catalogue',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    workstationId: uuid('workstation_id')
      .notNull()
      .references(() => workstationCatalogue.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('machinery_catalogue_tenant_code_unique').on(table.tenantId, table.code),
    index('machinery_catalogue_tenant_id_idx').on(table.tenantId),
    index('machinery_catalogue_workstation_id_idx').on(table.workstationId),
  ],
);

export const hazardCategories = pgTable(
  'hazard_categories',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    severity: varchar('severity', { length: 32 }).notNull().default('medium'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('hazard_categories_tenant_code_unique').on(table.tenantId, table.code),
    index('hazard_categories_tenant_id_idx').on(table.tenantId),
  ],
);

export const safetyChecklists = pgTable(
  'safety_checklists',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    permitTypeId: uuid('permit_type_id').references(() => permitTypes.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('safety_checklists_tenant_code_unique').on(table.tenantId, table.code),
    index('safety_checklists_tenant_id_idx').on(table.tenantId),
    index('safety_checklists_permit_type_id_idx').on(table.permitTypeId),
  ],
);

export const safetyChecklistItems = pgTable(
  'safety_checklist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: auditColumns.createdAt,
    createdBy: auditColumns.createdBy,
    checklistId: uuid('checklist_id')
      .notNull()
      .references(() => safetyChecklists.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    description: text('description').notNull(),
    isMandatory: boolean('is_mandatory').notNull().default(false),
  },
  (table) => [
    uniqueIndex('safety_checklist_items_checklist_sequence_unique').on(
      table.checklistId,
      table.sequence,
    ),
    index('safety_checklist_items_checklist_id_idx').on(table.checklistId),
  ],
);

export const importJobs = pgTable(
  'import_jobs',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    storageBucket: varchar('storage_bucket', { length: 128 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    partialImport: boolean('partial_import').notNull().default(false),
    totalRows: integer('total_rows').notNull().default(0),
    successCount: integer('success_count').notNull().default(0),
    failureCount: integer('failure_count').notNull().default(0),
    errorSummary: text('error_summary'),
  },
  (table) => [
    index('import_jobs_tenant_id_idx').on(table.tenantId),
    index('import_jobs_status_idx').on(table.status),
  ],
);

export const importJobResults = pgTable(
  'import_job_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: auditColumns.createdAt,
    importJobId: uuid('import_job_id')
      .notNull()
      .references(() => importJobs.id, { onDelete: 'cascade' }),
    rowNumber: integer('row_number').notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    message: text('message'),
    entityId: uuid('entity_id'),
  },
  (table) => [
    index('import_job_results_import_job_id_idx').on(table.importJobId),
  ],
);
