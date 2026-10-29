import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { isolationCertificatePoints } from './isolation-certificate-points';
import { isolationCertificates } from './isolation-certificate';

export const BLIND_TYPES = [
  'slip_blind',
  'spectacle_blind',
  'pancake_blind',
  'spade',
] as const;
export type BlindType = (typeof BLIND_TYPES)[number];

export const BLIND_STATUSES = [
  'planned',
  'installed_torqued',
  'removal_verified',
] as const;
export type BlindStatus = (typeof BLIND_STATUSES)[number];

export const isolationBlinds = pgTable(
  'isolation_blinds',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    pointId: uuid('point_id').references(() => isolationCertificatePoints.id, { onDelete: 'set null' }),
    blindTagNumber: varchar('blind_tag_number', { length: 64 }).notNull(),
    lineTagNumber: varchar('line_tag_number', { length: 128 }).notNull(),
    pidReference: varchar('pid_reference', { length: 128 }),
    blindType: varchar('blind_type', { length: 32 }).notNull().default('slip_blind'),
    flangeRating: varchar('flange_rating', { length: 64 }),
    blindSize: varchar('blind_size', { length: 64 }),
    materialThickness: varchar('material_thickness', { length: 64 }),
    status: varchar('status', { length: 32 }).notNull().default('planned'),
    installedAt: timestamp('installed_at', { withTimezone: true }),
    installedBy: uuid('installed_by'),
    installedTorqueNm: doublePrecision('installed_torque_nm'),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedBy: uuid('removed_by'),
    gasketReplaced: boolean('gasket_replaced').notNull().default(false),
  },
  (table) => [
    uniqueIndex('isolation_blinds_tenant_tag_unique').on(
      table.tenantId,
      table.blindTagNumber,
    ),
    index('isolation_blinds_tenant_id_idx').on(table.tenantId),
    index('isolation_blinds_cert_id_idx').on(table.certificateId),
    index('isolation_blinds_status_idx').on(table.certificateId, table.status),
  ],
);
