import { index, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { auditColumns } from './base';

export const agencies = pgTable(
  'agencies',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 64 }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('agencies_tenant_code_unique').on(table.tenantId, table.code),
    index('agencies_tenant_id_idx').on(table.tenantId),
  ],
);

export const employees = pgTable(
  'employees',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 64 }),
    departmentId: uuid('department_id'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    index('employees_tenant_id_idx').on(table.tenantId),
    index('employees_department_id_idx').on(table.departmentId),
  ],
);

export const contractors = pgTable(
  'contractors',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 64 }),
    agencyId: uuid('agency_id'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    index('contractors_tenant_id_idx').on(table.tenantId),
    index('contractors_agency_id_idx').on(table.agencyId),
  ],
);

export const competencies = pgTable(
  'competencies',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    workforceUserId: uuid('workforce_user_id'),
    certificationName: varchar('certification_name', { length: 255 }),
    expiryDate: varchar('expiry_date', { length: 32 }),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [index('competencies_tenant_id_idx').on(table.tenantId)],
);
