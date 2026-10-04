import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  key: text('key'),
  name: text('name').notNull(),
  permissions: text('permissions').array().notNull().default([]),
  status: text('status', { enum: ['active', 'retired'] }).notNull().default('active'),
  ...timestamps,
});

export const plantAssignments = pgTable('plant_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  plantId: uuid('plant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  roleId: uuid('role_id').notNull(),
  departmentId: uuid('department_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminAssignments = pgTable('admin_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  role: text('role', { enum: ['TENANT_ORG_ADMIN', 'LEGAL_ORG_ADMIN'] }).notNull(),
  legalEntityId: uuid('legal_entity_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
