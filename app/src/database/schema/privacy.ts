import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Primary key (tenant_id, version) lives in the SQL migration; queries here need only the columns.
export const tenantDataKeys = pgTable('tenant_data_keys', {
  tenantId: uuid('tenant_id').notNull(),
  version: integer('version').notNull(),
  wrappedKey: text('wrapped_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
