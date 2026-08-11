import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { permits } from './permit';

export const COSIGN_SOURCE_ENTITY_TYPES = [
  'permit_progress',
  'permit_evidence',
  'permit_daily_progress',
  'lototo_checklist',
] as const;
export type CosignSourceEntityType = (typeof COSIGN_SOURCE_ENTITY_TYPES)[number];

/** FR-ROL-004: supervisor co-sign is a linked record, never an overwrite of executor evidence. */
export const supervisorCosignatures = pgTable(
  'supervisor_cosignatures',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    sourceEntityType: varchar('source_entity_type', { length: 64 }).notNull(),
    sourceEntityId: uuid('source_entity_id').notNull(),
    supervisorId: uuid('supervisor_id').notNull(),
    comment: text('comment'),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('supervisor_cosignatures_unique').on(
      table.tenantId,
      table.sourceEntityType,
      table.sourceEntityId,
      table.supervisorId,
    ),
    index('supervisor_cosignatures_permit_id_idx').on(table.permitId),
    index('supervisor_cosignatures_source_idx').on(table.sourceEntityType, table.sourceEntityId),
  ],
);
