import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { auditColumns } from './base';

/** Copied onto a tenant only when that tenant is created. */
export const defaultLocationTypes = pgTable(
  'default_location_types',
  {
    ...auditColumns,
    name: varchar('name', { length: 64 }).notNull(),
    description: text('description'),
  },
  (table) => [uniqueIndex('default_location_types_name_unique').on(table.name)],
);

export const defaultPpeCategories = pgTable(
  'default_ppe_categories',
  {
    ...auditColumns,
    name: varchar('name', { length: 128 }).notNull(),
    isFallback: boolean('is_fallback').notNull().default(false),
  },
  (table) => [
    uniqueIndex('default_ppe_categories_name_unique').on(table.name),
    uniqueIndex('default_ppe_categories_fallback_unique')
      .on(table.isFallback)
      .where(sql`${table.isFallback} = true`),
  ],
);

export const defaultPpeItems = pgTable(
  'default_ppe_items',
  {
    ...auditColumns,
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => defaultPpeCategories.id),
    description: text('description'),
  },
  (table) => [
    uniqueIndex('default_ppe_items_code_unique').on(table.code),
    index('default_ppe_items_category_id_idx').on(table.categoryId),
  ],
);

export const defaultEnergySources = pgTable(
  'default_energy_sources',
  {
    ...auditColumns,
    name: varchar('name', { length: 64 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    isFallback: boolean('is_fallback').notNull().default(false),
  },
  (table) => [
    uniqueIndex('default_energy_sources_name_unique').on(table.name),
    uniqueIndex('default_energy_sources_code_unique').on(table.code),
    uniqueIndex('default_energy_sources_fallback_unique')
      .on(table.isFallback)
      .where(sql`${table.isFallback} = true`),
  ],
);

export const defaultPermitTypes = pgTable(
  'default_permit_types',
  {
    ...auditColumns,
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 7 }).notNull(),
  },
  (table) => [uniqueIndex('default_permit_types_code_unique').on(table.code)],
);

export const defaultAssetTypes = pgTable(
  'default_asset_types',
  {
    ...auditColumns,
    name: varchar('name', { length: 64 }).notNull(),
    description: text('description'),
  },
  (table) => [uniqueIndex('default_asset_types_name_unique').on(sql`lower(${table.name})`)],
);

export const defaultHazards = pgTable(
  'default_hazards',
  {
    ...auditColumns,
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 255 }).notNull().default(''),
    severity: varchar('severity', { length: 32 }).notNull().default('medium'),
    description: text('description'),
    risks: jsonb('risks').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    consequences: jsonb('consequences').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    controls: jsonb('controls').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    permitTypeCodes: varchar('permit_type_codes', { length: 16 }).array().notNull().default([]),
  },
  (table) => [uniqueIndex('default_hazards_code_unique').on(sql`lower(${table.code})`)],
);

export const defaultHazardPpe = pgTable(
  'default_hazard_ppe',
  {
    ...auditColumns,
    hazardId: uuid('hazard_id')
      .notNull()
      .references(() => defaultHazards.id, { onDelete: 'cascade' }),
    ppeItemId: uuid('ppe_item_id')
      .notNull()
      .references(() => defaultPpeItems.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('default_hazard_ppe_pair_unique').on(table.hazardId, table.ppeItemId)],
);
