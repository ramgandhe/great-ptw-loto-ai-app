import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';

// SQL in migrations/ is the source of truth (policies, grants, composite keys); these definitions type queries.
export const organisations = pgTable('organisations', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['organisation', 'agency'] }).notNull(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  industry: text('industry'),
  status: text('status', { enum: ['trial', 'active', 'read_only', 'suspended'] }).notNull().default('active'),
  ...timestamps,
});

export const legalEntities = pgTable('legal_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalName: text('legal_name').notNull(),
  shortCode: text('short_code').notNull(),
  country: text('country').notNull(),
  status: text('status', { enum: ['active', 'retired'] }).notNull().default('active'),
  ...timestamps,
});

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'retired'] }).notNull().default('active'),
  ...timestamps,
});

export const plants = pgTable('plants', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  timeZone: text('time_zone').notNull(),
  status: text('status', { enum: ['setting_up', 'live', 'retired'] }).notNull().default('setting_up'),
  ...timestamps,
});
