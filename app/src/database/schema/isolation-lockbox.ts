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
import { isolationCertificates } from './isolation-certificate';
import { permits } from './permit';

export const LOCKBOX_CUSTODY_STATUSES = [
  'open_for_keys',
  'keys_deposited_sealed',
  'keys_released',
] as const;
export type LockboxCustodyStatus = (typeof LOCKBOX_CUSTODY_STATUSES)[number];

export const isolationLockboxes = pgTable(
  'isolation_lockboxes',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    boxNumber: varchar('box_number', { length: 64 }).notNull(),
    locationDescription: text('location_description'),
    masterLockSerial: varchar('master_lock_serial', { length: 64 }).notNull(),
    custodyStatus: varchar('custody_status', { length: 32 })
      .notNull()
      .default('open_for_keys'),
    sealedAt: timestamp('sealed_at', { withTimezone: true }),
    sealedBy: uuid('sealed_by'),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedBy: uuid('released_by'),
  },
  (table) => [
    uniqueIndex('isolation_lockboxes_cert_box_unique').on(
      table.certificateId,
      table.boxNumber,
    ),
    index('isolation_lockboxes_tenant_id_idx').on(table.tenantId),
    index('isolation_lockboxes_cert_id_idx').on(table.certificateId),
    index('isolation_lockboxes_status_idx').on(table.custodyStatus),
  ],
);

export const lockboxCrewLocks = pgTable(
  'lockbox_crew_locks',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    lockboxId: uuid('lockbox_id')
      .notNull()
      .references(() => isolationLockboxes.id, { onDelete: 'cascade' }),
    permitId: uuid('permit_id').references(() => permits.id, {
      onDelete: 'set null',
    }),
    workforceUserId: uuid('workforce_user_id').notNull(),
    workerName: varchar('worker_name', { length: 255 }).notNull(),
    company: varchar('company', { length: 255 }),
    personalLockNumber: varchar('personal_lock_number', { length: 64 }).notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    appliedBy: uuid('applied_by'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedBy: uuid('removed_by'),
  },
  (table) => [
    index('lockbox_crew_locks_tenant_id_idx').on(table.tenantId),
    index('lockbox_crew_locks_lockbox_id_idx').on(table.lockboxId),
    index('lockbox_crew_locks_user_id_idx').on(table.workforceUserId),
    index('lockbox_crew_locks_permit_id_idx').on(table.permitId),
    index('lockbox_crew_locks_active_idx').on(table.lockboxId, table.removedAt),
  ],
);
