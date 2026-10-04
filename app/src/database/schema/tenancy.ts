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
