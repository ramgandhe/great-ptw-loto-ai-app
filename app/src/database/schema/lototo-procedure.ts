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
import { machineryCatalogue, workstationCatalogue } from './master-data';
import { lototoPlans } from './lototo';
import { permits } from './permit';

export const LOTOTO_PROCEDURE_STATUSES = ['draft', 'published', 'inactive'] as const;
export type LototoProcedureStatus = (typeof LOTOTO_PROCEDURE_STATUSES)[number];

export const LOTOTO_SEQUENCE_PHASES = ['apply', 'remove'] as const;
export type LototoSequencePhase = (typeof LOTOTO_SEQUENCE_PHASES)[number];

export const lototoProcedures = pgTable(
  'lototo_procedures',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    machineryId: uuid('machinery_id')
      .notNull()
      .references(() => machineryCatalogue.id, { onDelete: 'restrict' }),
    workstationId: uuid('workstation_id').references(() => workstationCatalogue.id, {
      onDelete: 'restrict',
    }),
    code: varchar('code', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
    publishedVersionId: uuid('published_version_id'),
    legacyPlanId: uuid('legacy_plan_id').references(() => lototoPlans.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('lototo_procedures_tenant_id_idx').on(table.tenantId),
    index('lototo_procedures_machinery_id_idx').on(table.machineryId),
    uniqueIndex('lototo_procedures_tenant_code_unique').on(table.tenantId, table.code),
    uniqueIndex('lototo_procedures_legacy_plan_id_unique').on(table.legacyPlanId),
  ],
);

export const lototoProcedureVersions = pgTable(
  'lototo_procedure_versions',
  {
    ...auditColumns,
    procedureId: uuid('procedure_id')
      .notNull()
      .references(() => lototoProcedures.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    facility: varchar('facility', { length: 255 }),
    locationText: varchar('location_text', { length: 255 }),
    purpose: text('purpose'),
    scope: text('scope'),
    authorization: text('authorization'),
    enforcement: text('enforcement'),
    description: text('description'),
    note: text('note'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    index('lototo_procedure_versions_procedure_id_idx').on(table.procedureId),
    uniqueIndex('lototo_procedure_versions_procedure_number_unique').on(
      table.procedureId,
      table.versionNumber,
    ),
  ],
);

export const lototoProcedureLockoutPoints = pgTable(
  'lototo_procedure_lockout_points',
  {
    ...auditColumns,
    versionId: uuid('version_id')
      .notNull()
      .references(() => lototoProcedureVersions.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    pointCode: varchar('point_code', { length: 64 }).notNull(),
    energyType: varchar('energy_type', { length: 64 }).notNull(),
    magnitude: varchar('magnitude', { length: 128 }),
    locationText: text('location_text'),
    action: text('action'),
    device: varchar('device', { length: 128 }),
    verificationMethod: text('verification_method'),
  },
  (table) => [
    index('lototo_procedure_lockout_points_version_id_idx').on(table.versionId),
    uniqueIndex('lototo_procedure_lockout_points_version_code_unique').on(
      table.versionId,
      table.pointCode,
    ),
    uniqueIndex('lototo_procedure_lockout_points_version_order_unique').on(
      table.versionId,
      table.sortOrder,
    ),
  ],
);

export const lototoProcedureSequenceSteps = pgTable(
  'lototo_procedure_sequence_steps',
  {
    ...auditColumns,
    versionId: uuid('version_id')
      .notNull()
      .references(() => lototoProcedureVersions.id, { onDelete: 'cascade' }),
    phase: varchar('phase', { length: 16 }).notNull(),
    sequenceOrder: integer('sequence_order').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
  },
  (table) => [
    index('lototo_procedure_sequence_steps_version_id_idx').on(table.versionId),
    uniqueIndex('lototo_procedure_sequence_steps_phase_order_unique').on(
      table.versionId,
      table.phase,
      table.sequenceOrder,
    ),
  ],
);

export const lototoProcedureAuthorizedRoles = pgTable(
  'lototo_procedure_authorized_roles',
  {
    ...auditColumns,
    versionId: uuid('version_id')
      .notNull()
      .references(() => lototoProcedureVersions.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 64 }).notNull(),
  },
  (table) => [
    uniqueIndex('lototo_procedure_authorized_roles_version_role_unique').on(
      table.versionId,
      table.role,
    ),
  ],
);

export const lototoProcedurePhotos = pgTable(
  'lototo_procedure_photos',
  {
    ...auditColumns,
    versionId: uuid('version_id')
      .notNull()
      .references(() => lototoProcedureVersions.id, { onDelete: 'cascade' }),
    lockoutPointId: uuid('lockout_point_id').references(() => lototoProcedureLockoutPoints.id, {
      onDelete: 'set null',
    }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 128 }).notNull(),
    storageBucket: varchar('storage_bucket', { length: 128 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
  },
  (table) => [index('lototo_procedure_photos_version_id_idx').on(table.versionId)],
);

export const permitLototoInstances = pgTable(
  'permit_lototo_instances',
  {
    ...auditColumns,
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    procedureId: uuid('procedure_id')
      .notNull()
      .references(() => lototoProcedures.id, { onDelete: 'restrict' }),
    procedureVersionId: uuid('procedure_version_id')
      .notNull()
      .references(() => lototoProcedureVersions.id, { onDelete: 'restrict' }),
    frozenAt: timestamp('frozen_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('permit_lototo_instances_permit_procedure_unique').on(
      table.permitId,
      table.procedureId,
    ),
    index('permit_lototo_instances_permit_id_idx').on(table.permitId),
    index('permit_lototo_instances_procedure_id_idx').on(table.procedureId),
  ],
);

export const permitLototoExtraPoints = pgTable(
  'permit_lototo_extra_points',
  {
    ...auditColumns,
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => permitLototoInstances.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull(),
    pointCode: varchar('point_code', { length: 64 }).notNull(),
    energyType: varchar('energy_type', { length: 64 }).notNull(),
    magnitude: varchar('magnitude', { length: 128 }),
    locationText: text('location_text'),
    action: text('action'),
    device: varchar('device', { length: 128 }),
    verificationMethod: text('verification_method'),
  },
  (table) => [
    index('permit_lototo_extra_points_instance_id_idx').on(table.instanceId),
    uniqueIndex('permit_lototo_extra_points_instance_code_unique').on(
      table.instanceId,
      table.pointCode,
    ),
  ],
);

export const permitLototoStepNa = pgTable(
  'permit_lototo_step_na',
  {
    ...auditColumns,
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => permitLototoInstances.id, { onDelete: 'cascade' }),
    basePointId: uuid('base_point_id').references(() => lototoProcedureLockoutPoints.id, {
      onDelete: 'restrict',
    }),
    extraPointId: uuid('extra_point_id').references(() => permitLototoExtraPoints.id, {
      onDelete: 'cascade',
    }),
    reason: text('reason').notNull(),
  },
  (table) => [
    index('permit_lototo_step_na_instance_id_idx').on(table.instanceId),
    uniqueIndex('permit_lototo_step_na_base_point_unique').on(table.instanceId, table.basePointId),
    uniqueIndex('permit_lototo_step_na_extra_point_unique').on(table.instanceId, table.extraPointId),
  ],
);

export const permitLototoCrew = pgTable(
  'permit_lototo_crew',
  {
    ...auditColumns,
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => permitLototoInstances.id, { onDelete: 'cascade' }),
    workforceUserId: uuid('workforce_user_id').notNull(),
  },
  (table) => [
    uniqueIndex('permit_lototo_crew_instance_user_unique').on(
      table.instanceId,
      table.workforceUserId,
    ),
    index('permit_lototo_crew_instance_id_idx').on(table.instanceId),
  ],
);

export const permitLototoVerifiers = pgTable(
  'permit_lototo_verifiers',
  {
    ...auditColumns,
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => permitLototoInstances.id, { onDelete: 'cascade' }),
    workforceUserId: uuid('workforce_user_id').notNull(),
  },
  (table) => [
    uniqueIndex('permit_lototo_verifiers_instance_user_unique').on(
      table.instanceId,
      table.workforceUserId,
    ),
    index('permit_lototo_verifiers_instance_id_idx').on(table.instanceId),
  ],
);

export const PERMIT_LOTOTO_VERIFY_RESULTS = ['pass', 'fail'] as const;
export type PermitLototoVerifyResult = (typeof PERMIT_LOTOTO_VERIFY_RESULTS)[number];

export const permitLototoCrewActions = pgTable(
  'permit_lototo_crew_actions',
  {
    ...auditColumns,
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => permitLototoInstances.id, { onDelete: 'cascade' }),
    basePointId: uuid('base_point_id').references(() => lototoProcedureLockoutPoints.id, {
      onDelete: 'restrict',
    }),
    extraPointId: uuid('extra_point_id').references(() => permitLototoExtraPoints.id, {
      onDelete: 'cascade',
    }),
    lockTagId: varchar('lock_tag_id', { length: 64 }).notNull(),
    reading: varchar('reading', { length: 128 }),
    comment: text('comment'),
    completedBy: uuid('completed_by').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('permit_lototo_crew_actions_instance_id_idx').on(table.instanceId),
  ],
);

export const permitLototoPointVerifications = pgTable(
  'permit_lototo_point_verifications',
  {
    ...auditColumns,
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => permitLototoInstances.id, { onDelete: 'cascade' }),
    basePointId: uuid('base_point_id').references(() => lototoProcedureLockoutPoints.id, {
      onDelete: 'restrict',
    }),
    extraPointId: uuid('extra_point_id').references(() => permitLototoExtraPoints.id, {
      onDelete: 'cascade',
    }),
    result: varchar('result', { length: 32 }).notNull(),
    tryOutCompleted: boolean('try_out_completed').notNull(),
    reading: varchar('reading', { length: 128 }),
    comment: text('comment'),
    verifiedBy: uuid('verified_by').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('permit_lototo_point_verifications_instance_id_idx').on(table.instanceId),
  ],
);

export const permitLototoDuringChecks = pgTable(
  'permit_lototo_during_checks',
  {
    ...auditColumns,
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => permitLototoInstances.id, { onDelete: 'cascade' }),
    locksRemain: boolean('locks_remain').notNull(),
    comment: text('comment'),
    confirmedBy: uuid('confirmed_by').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('permit_lototo_during_checks_instance_id_idx').on(table.instanceId)],
);

export const permitLototoRestorations = pgTable(
  'permit_lototo_restorations',
  {
    ...auditColumns,
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => permitLototoInstances.id, { onDelete: 'cascade' }),
    basePointId: uuid('base_point_id').references(() => lototoProcedureLockoutPoints.id, {
      onDelete: 'restrict',
    }),
    extraPointId: uuid('extra_point_id').references(() => permitLototoExtraPoints.id, {
      onDelete: 'cascade',
    }),
    lockTagId: varchar('lock_tag_id', { length: 64 }).notNull(),
    comment: text('comment'),
    restoredBy: uuid('restored_by').notNull(),
    restoredAt: timestamp('restored_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('permit_lototo_restorations_instance_id_idx').on(table.instanceId)],
);

export const permitLototoRestorationVerifications = pgTable(
  'permit_lototo_restoration_verifications',
  {
    ...auditColumns,
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => permitLototoInstances.id, { onDelete: 'cascade' }),
    basePointId: uuid('base_point_id').references(() => lototoProcedureLockoutPoints.id, {
      onDelete: 'restrict',
    }),
    extraPointId: uuid('extra_point_id').references(() => permitLototoExtraPoints.id, {
      onDelete: 'cascade',
    }),
    result: varchar('result', { length: 32 }).notNull(),
    comment: text('comment'),
    verifiedBy: uuid('verified_by').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('permit_lototo_restoration_verifications_instance_id_idx').on(table.instanceId)],
);
