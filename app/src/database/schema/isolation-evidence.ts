import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { isolationCertificatePoints, isolationPointProofs } from './isolation-certificate-points';
import { isolationCertificates } from './isolation-certificate';
import { isolationLockboxes, lockboxCrewLocks } from './isolation-lockbox';

export const EVIDENCE_KINDS = ['apply', 'proof', 'restore'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const lototoTenantOptions = pgTable('lototo_tenant_options', {
  tenantId: uuid('tenant_id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  requireEvidencePhoto: boolean('require_evidence_photo').notNull().default(false),
  requireDistinctProver: boolean('require_distinct_prover').notNull().default(false),
  requireSecondApprovalBeforeIsolate: boolean(
    'require_second_approval_before_isolate',
  )
    .notNull()
    .default(false),
});

export const isolationPointEvidence = pgTable(
  'isolation_point_evidence',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    pointId: uuid('point_id')
      .notNull()
      .references(() => isolationCertificatePoints.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 16 }).notNull(),
    proofId: uuid('proof_id').references(() => isolationPointProofs.id, {
      onDelete: 'set null',
    }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 128 }).notNull(),
    storageBucket: varchar('storage_bucket', { length: 128 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    uploadedBy: uuid('uploaded_by').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('isolation_point_evidence_cert_id_idx').on(table.certificateId),
    index('isolation_point_evidence_point_id_idx').on(table.pointId),
  ],
);

export const isolationAbsentLockRemovals = pgTable(
  'isolation_absent_lock_removals',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    lockboxId: uuid('lockbox_id').references(() => isolationLockboxes.id, {
      onDelete: 'set null',
    }),
    crewLockId: uuid('crew_lock_id').references(() => lockboxCrewLocks.id, {
      onDelete: 'set null',
    }),
    ownerUserId: uuid('owner_user_id').notNull(),
    ownerName: varchar('owner_name', { length: 255 }).notNull(),
    personalLockNumber: varchar('personal_lock_number', { length: 64 }).notNull(),
    contactAttempts: text('contact_attempts').notNull(),
    clearOfPlantConfirmed: boolean('clear_of_plant_confirmed').notNull().default(false),
    authoriserOneId: uuid('authoriser_one_id').notNull(),
    authoriserTwoId: uuid('authoriser_two_id').notNull(),
    reason: text('reason').notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }).notNull().defaultNow(),
    removedBy: uuid('removed_by').notNull(),
    ownerNotifiedAt: timestamp('owner_notified_at', { withTimezone: true }),
  },
  (table) => [
    index('isolation_absent_lock_removals_cert_id_idx').on(table.certificateId),
    index('isolation_absent_lock_removals_owner_idx').on(table.tenantId, table.ownerUserId),
  ],
);
