import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';

export const RECORD_STATUSES = ['active', 'archived'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const organisations = pgTable(
  'organisations',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    legalName: varchar('legal_name', { length: 255 }),
    registrationNumber: varchar('registration_number', { length: 128 }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('organisations_tenant_unique').on(table.tenantId),
    index('organisations_tenant_id_idx').on(table.tenantId),
  ],
);

export const plants = pgTable(
  'plants',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 64 }),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('plants_tenant_code_unique').on(table.tenantId, table.code),
    index('plants_tenant_id_idx').on(table.tenantId),
  ],
);

export const departments = pgTable(
  'departments',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    plantId: uuid('plant_id'),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 64 }),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('departments_tenant_code_unique').on(table.tenantId, table.code),
    index('departments_tenant_id_idx').on(table.tenantId),
    index('departments_plant_id_idx').on(table.plantId),
  ],
);

export const locations = pgTable(
  'locations',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    departmentId: uuid('department_id'),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 64 }),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('locations_tenant_code_unique').on(table.tenantId, table.code),
    index('locations_tenant_id_idx').on(table.tenantId),
    index('locations_department_id_idx').on(table.departmentId),
  ],
);

export const approvalWorkflows = pgTable(
  'approval_workflows',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 64 }),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    config: jsonb('config').$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex('approval_workflows_tenant_code_unique').on(table.tenantId, table.code),
    index('approval_workflows_tenant_id_idx').on(table.tenantId),
  ],
);

export const permitTemplates = pgTable(
  'permit_templates',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 64 }),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    config: jsonb('config').$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex('permit_templates_tenant_code_unique').on(table.tenantId, table.code),
    index('permit_templates_tenant_id_idx').on(table.tenantId),
  ],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    channel: varchar('channel', { length: 64 }),
    eventType: varchar('event_type', { length: 64 }),
    enabled: boolean('enabled').notNull().default(true),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [index('notification_preferences_tenant_id_idx').on(table.tenantId)],
);
