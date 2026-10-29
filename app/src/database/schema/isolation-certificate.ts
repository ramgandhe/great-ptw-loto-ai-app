import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { assets, sites, workLocations } from './place';
import { lototoProcedures, lototoProcedureVersions } from './lototo-procedure';

export const ISOLATION_CERTIFICATE_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'isolation_in_progress',
  'isolated_verified',
  'sanction_for_test',
  'restoration_in_progress',
  'restored_verified',
  'closed',
] as const;
export type IsolationCertificateStatus = (typeof ISOLATION_CERTIFICATE_STATUSES)[number];

export const ISOLATION_DISCIPLINES = [
  'electrical',
  'mechanical',
  'process',
  'instrumentation',
  'combined',
] as const;
export type IsolationDiscipline = (typeof ISOLATION_DISCIPLINES)[number];

export const isolationCertificates = pgTable(
  'isolation_certificates',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'restrict' }),
    certificateNumber: varchar('certificate_number', { length: 32 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    discipline: varchar('discipline', { length: 32 }).notNull().default('combined'),
    status: varchar('status', { length: 32 }).notNull().default('draft'),

    // Procedure template linkage (optional)
    procedureId: uuid('procedure_id').references(() => lototoProcedures.id, {
      onDelete: 'set null',
    }),
    procedureVersionId: uuid('procedure_version_id').references(() => lototoProcedureVersions.id, {
      onDelete: 'set null',
    }),

    // Location / Asset linkage
    workLocationId: uuid('work_location_id').references(() => workLocations.id, {
      onDelete: 'restrict',
    }),
    assetId: uuid('asset_id').references(() => assets.id, {
      onDelete: 'restrict',
    }),

    // Authorities and custody
    isolationAuthorityId: uuid('isolation_authority_id'),
    approverId: uuid('approver_id'),
    lockboxId: uuid('lockbox_id'),

    // Timestamps
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    isolatedAt: timestamp('isolated_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    restorationStartedAt: timestamp('restoration_started_at', { withTimezone: true }),
    restoredAt: timestamp('restored_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),

    // Long-Term Isolation (LTI) & Mothballing
    isLongTerm: boolean('is_long_term').notNull().default(false),
    ltiReason: text('lti_reason'),
    ltiAuditIntervalDays: integer('lti_audit_interval_days').notNull().default(30),
    nextAuditDueDate: timestamp('next_audit_due_date', { withTimezone: true }),
    lastAuditedAt: timestamp('last_audited_at', { withTimezone: true }),

    description: text('description'),
    safetyPrecautions: text('safety_precautions'),
  },
  (table) => [
    uniqueIndex('isolation_certificates_tenant_number_unique').on(
      table.tenantId,
      table.certificateNumber,
    ),
    index('isolation_certificates_tenant_id_idx').on(table.tenantId),
    index('isolation_certificates_tenant_status_idx').on(table.tenantId, table.status),
    index('isolation_certificates_site_id_idx').on(table.siteId),
    index('isolation_certificates_asset_id_idx').on(table.assetId),
    index('isolation_certificates_work_location_id_idx').on(table.workLocationId),
    index('isolation_certificates_procedure_id_idx').on(table.procedureId),
    index('isolation_certificates_is_long_term_idx').on(table.tenantId, table.isLongTerm),
  ],
);
