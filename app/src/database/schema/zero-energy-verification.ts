import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { isolationCertificates } from './isolation-certificate';

export const ZVE_CATEGORIES = [
  'electrical_live_dead_live',
  'pressure_bleed_vent',
  'mechanical_jog_tryout',
  'chemical_sniff_purge',
  'stored_energy_block',
] as const;
export type ZveCategory = (typeof ZVE_CATEGORIES)[number];

export const ZVE_RESULTS = ['pass', 'fail'] as const;
export type ZveResult = (typeof ZVE_RESULTS)[number];

export const zeroEnergyVerifications = pgTable(
  'zero_energy_verifications',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    pointCode: varchar('point_code', { length: 64 }).notNull(),
    verificationCategory: varchar('verification_category', { length: 64 }).notNull(),
    result: varchar('result', { length: 32 }).notNull().default('pass'),

    // Calibrated Instrument Metadata
    instrumentMakeModel: varchar('instrument_make_model', { length: 128 }),
    instrumentSerialNo: varchar('instrument_serial_no', { length: 128 }),
    calibrationExpiryDate: timestamp('calibration_expiry_date', { withTimezone: true }),

    // Structured Readings Payload
    readingsPayload: jsonb('readings_payload').$type<Record<string, unknown>>().notNull(),

    // Photographic Evidence
    photoStorageKey: varchar('photo_storage_key', { length: 512 }),
    photoChecksum: varchar('photo_checksum', { length: 128 }),

    // Signoff & Verification
    verifiedBy: uuid('verified_by').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
    comment: text('comment'),
  },
  (table) => [
    index('zero_energy_verifications_tenant_id_idx').on(table.tenantId),
    index('zero_energy_verifications_cert_id_idx').on(table.certificateId),
    index('zero_energy_verifications_point_code_idx').on(table.certificateId, table.pointCode),
    index('zero_energy_verifications_verified_by_idx').on(table.verifiedBy),
  ],
);
