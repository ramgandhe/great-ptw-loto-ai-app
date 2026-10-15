import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';

/** Refined 14 October 2026. Replaces plants. */
export const sites = pgTable(
  'sites',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    address: text('address'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('sites_tenant_code_unique').on(table.tenantId, table.code),
    index('sites_tenant_id_idx').on(table.tenantId),
  ],
);

/** Keycloak subject of a user who may work at this site. Owner and admin are not stored here. */
export const siteMembers = pgTable(
  'site_members',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'restrict' }),
    userId: varchar('user_id', { length: 128 }).notNull(),
  },
  (table) => [
    uniqueIndex('site_members_site_user_unique').on(table.siteId, table.userId),
    index('site_members_tenant_id_idx').on(table.tenantId),
    index('site_members_user_id_idx').on(table.userId),
  ],
);

export const locationTypes = pgTable(
  'location_types',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('location_types_tenant_name_unique').on(table.tenantId, table.name),
    index('location_types_tenant_id_idx').on(table.tenantId),
  ],
);

/**
 * Tree of any depth under a site. Children are rows whose parent_id is this id.
 * legacy_source records which old table the row was copied from.
 */
export const workLocations = pgTable(
  'work_locations',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    locationTypeId: uuid('location_type_id').references(() => locationTypes.id, {
      onDelete: 'set null',
    }),
    parentId: uuid('parent_id').references((): AnyPgColumn => workLocations.id, {
      onDelete: 'restrict',
    }),
    description: text('description'),
    address: text('address'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    /** Path captured for display, e.g. "Refinery A › Pump Area". */
    pathText: text('path_text'),
    legacySource: varchar('legacy_source', { length: 32 }),
  },
  (table) => [
    uniqueIndex('work_locations_site_code_unique').on(table.siteId, table.code),
    index('work_locations_tenant_id_idx').on(table.tenantId),
    index('work_locations_site_id_idx').on(table.siteId),
    index('work_locations_parent_id_idx').on(table.parentId),
  ],
);

/** Own approver list for a work location. Absent rows mean inherit. */
export const workLocationApprovers = pgTable(
  'work_location_approvers',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    workLocationId: uuid('work_location_id')
      .notNull()
      .references(() => workLocations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 }).notNull(),
  },
  (table) => [
    uniqueIndex('work_location_approvers_location_user_unique').on(
      table.workLocationId,
      table.userId,
    ),
    index('work_location_approvers_tenant_id_idx').on(table.tenantId),
  ],
);

export const assetTypes = pgTable(
  'asset_types',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('asset_types_tenant_name_unique').on(table.tenantId, table.name),
    index('asset_types_tenant_id_idx').on(table.tenantId),
  ],
);

/** Tag is unique per site. site_id is stored so that uniqueness can be indexed. */
export const assets = pgTable(
  'assets',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'restrict' }),
    workLocationId: uuid('work_location_id')
      .notNull()
      .references(() => workLocations.id, { onDelete: 'restrict' }),
    tag: varchar('tag', { length: 64 }).notNull(),
    assetNumber: varchar('asset_number', { length: 64 }),
    name: varchar('name', { length: 255 }).notNull(),
    assetTypeId: uuid('asset_type_id').references(() => assetTypes.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    parentAssetId: uuid('parent_asset_id').references((): AnyPgColumn => assets.id, {
      onDelete: 'restrict',
    }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('assets_site_tag_unique').on(table.siteId, table.tag),
    uniqueIndex('assets_tenant_asset_number_unique')
      .on(table.tenantId, table.assetNumber)
      .where(sql`${table.assetNumber} IS NOT NULL`),
    index('assets_tenant_id_idx').on(table.tenantId),
    index('assets_site_id_idx').on(table.siteId),
    index('assets_work_location_id_idx').on(table.workLocationId),
    index('assets_parent_asset_id_idx').on(table.parentAssetId),
  ],
);
