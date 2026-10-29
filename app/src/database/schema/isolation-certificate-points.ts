import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { isolationCertificates } from './isolation-certificate';
import { lototoProcedureLockoutPoints } from './lototo-procedure';

export const isolationCertificatePoints = pgTable(
  'isolation_certificate_points',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    sourcePointId: uuid('source_point_id').references(() => lototoProcedureLockoutPoints.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order').notNull(),
    removeOrder: integer('remove_order'),
    pointCode: varchar('point_code', { length: 64 }).notNull(),
    energyType: varchar('energy_type', { length: 64 }).notNull(),
    energyOtherText: varchar('energy_other_text', { length: 255 }),
    magnitude: varchar('magnitude', { length: 128 }),
    locationText: text('location_text'),
    method: varchar('method', { length: 64 }),
    normalPosition: varchar('normal_position', { length: 128 }),
    isolatedPosition: varchar('isolated_position', { length: 128 }),
    action: text('action'),
    restoreAction: text('restore_action'),
    device: varchar('device', { length: 128 }),
    proof: varchar('proof', { length: 64 }).notNull(),
    drawingReference: varchar('drawing_reference', { length: 255 }),
    positionConfirmed: varchar('position_confirmed', { length: 128 }),
    lockNumber: varchar('lock_number', { length: 64 }),
    tagNumber: varchar('tag_number', { length: 64 }),
    appliedBy: uuid('applied_by'),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    restoredBy: uuid('restored_by'),
    restoredAt: timestamp('restored_at', { withTimezone: true }),
  },
  (table) => [
    index('isolation_certificate_points_cert_id_idx').on(table.certificateId),
    uniqueIndex('isolation_certificate_points_cert_code_unique').on(table.certificateId, table.pointCode),
    uniqueIndex('isolation_certificate_points_cert_order_unique').on(table.certificateId, table.sortOrder),
  ],
);

export const isolationPointProofs = pgTable(
  'isolation_point_proofs',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    pointId: uuid('point_id')
      .notNull()
      .references(() => isolationCertificatePoints.id, { onDelete: 'cascade' }),
    proof: varchar('proof', { length: 64 }).notNull(),
    result: varchar('result', { length: 16 }).notNull(),
    instrumentMakeModel: varchar('instrument_make_model', { length: 128 }),
    instrumentSerialNo: varchar('instrument_serial_no', { length: 128 }),
    calibrationExpiryDate: varchar('calibration_expiry_date', { length: 10 }),
    readings: jsonb('readings').$type<Record<string, unknown>>().notNull(),
    comment: text('comment'),
    verifiedBy: uuid('verified_by').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('isolation_point_proofs_cert_id_idx').on(table.certificateId),
    index('isolation_point_proofs_point_id_idx').on(table.pointId),
  ],
);
