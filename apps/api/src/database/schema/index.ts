import { pgTable, uuid, varchar, text, jsonb } from 'drizzle-orm/pg-core';

export * from './base';
export * from './master-data';

import { auditColumns } from './base';

export const platformMetadata = pgTable('platform_metadata', {
  ...auditColumns,
  key: varchar('key', { length: 128 }).notNull().unique(),
  value: text('value').notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  ...auditColumns,
  action: varchar('action', { length: 64 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: uuid('entity_id'),
  userId: uuid('user_id'),
  tenantId: uuid('tenant_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
});
