import {
  boolean,
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

export const SANCTION_TEST_STATUSES = ['in_test', 'completed'] as const;
export type SanctionTestStatus = (typeof SANCTION_TEST_STATUSES)[number];

export const isolationSanctionTests = pgTable(
  'isolation_sanction_tests',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    certificateId: uuid('certificate_id')
      .notNull()
      .references(() => isolationCertificates.id, { onDelete: 'cascade' }),
    testReason: text('test_reason').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('in_test'),
    authorizedBy: uuid('authorized_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    pointsTemporarilyDeisolated: jsonb('points_temporarily_deisolated')
      .$type<string[]>()
      .notNull(),
    preTestSafetyChecklist: jsonb('pre_test_safety_checklist')
      .$type<Record<string, boolean>>()
      .notNull(),
    postTestZeroEnergyVerified: boolean('post_test_zero_energy_verified')
      .notNull()
      .default(false),
    postTestVerifierId: uuid('post_test_verifier_id'),
    postTestVerifiedAt: timestamp('post_test_verified_at', { withTimezone: true }),
    testNotes: text('test_notes'),
  },
  (table) => [
    index('isolation_sanction_tests_tenant_id_idx').on(table.tenantId),
    index('isolation_sanction_tests_cert_id_idx').on(table.certificateId),
    index('isolation_sanction_tests_status_idx').on(table.certificateId, table.status),
  ],
);
