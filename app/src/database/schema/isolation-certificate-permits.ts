import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { isolationCertificates } from './isolation-certificate';
import { permits } from './permit';

export const ATTACHMENT_STATUSES = ['attached', 'active_work', 'detached'] as const;
export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number];

export const isolationCertificatePermits = pgTable(
  'isolation_certificate_permits',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    attachmentStatus: varchar('attachment_status', { length: 32 })
      .notNull()
      .default('attached'),
    attachedAt: timestamp('attached_at', { withTimezone: true }).notNull().defaultNow(),
    attachedBy: uuid('attached_by'),
    detachedAt: timestamp('detached_at', { withTimezone: true }),
    detachedBy: uuid('detached_by'),
  },
  (table) => [
    uniqueIndex('isolation_certificate_permits_cert_permit_unique').on(
      table.certificateId,
      table.permitId,
    ),
    index('isolation_certificate_permits_tenant_id_idx').on(table.tenantId),
    index('isolation_certificate_permits_cert_id_idx').on(table.certificateId),
    index('isolation_certificate_permits_permit_id_idx').on(table.permitId),
    index('isolation_certificate_permits_status_idx').on(
      table.certificateId,
      table.attachmentStatus,
    ),
  ],
);
