import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { isolationCertificates } from './isolation-certificate';

export const isolationShiftHandovers = pgTable(
  'isolation_shift_handovers',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    outgoingAuthorityId: uuid('outgoing_authority_id'),
    incomingAuthorityId: uuid('incoming_authority_id').notNull(),
    jointInspectionCompleted: boolean('joint_inspection_completed').notNull().default(false),
    integrityNotes: text('integrity_notes'),
    activePermitsReviewed: boolean('active_permits_reviewed').notNull().default(false),
    handedOverAt: timestamp('handed_over_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('isolation_shift_handovers_tenant_id_idx').on(table.tenantId),
    index('isolation_shift_handovers_certificate_id_idx').on(table.certificateId, table.handedOverAt),
  ],
);

export const isolationLtiWalks = pgTable(
  'isolation_lti_walks',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    walkedAt: timestamp('walked_at', { withTimezone: true }).notNull().defaultNow(),
    walkedBy: uuid('walked_by').notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('isolation_lti_walks_tenant_id_idx').on(table.tenantId),
    index('isolation_lti_walks_certificate_id_idx').on(table.certificateId, table.walkedAt),
  ],
);
