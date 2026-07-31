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
import { permits } from './permit';

export const LOTOTO_PLAN_STATUSES = [
  'draft',
  'ready',
  'in_execution',
  'completed',
] as const;
export type LototoPlanStatus = (typeof LOTOTO_PLAN_STATUSES)[number];

export const LOTOTO_ASSIGNMENT_ROLES = [
  'isolation_officer',
  'verifier',
  'supervisor',
] as const;
export type LototoAssignmentRole = (typeof LOTOTO_ASSIGNMENT_ROLES)[number];

export const lototoPlans = pgTable(
  'lototo_plans',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    permitId: uuid('permit_id')
      .notNull()
      .references(() => permits.id, { onDelete: 'cascade' }),
    workstationId: uuid('workstation_id').references(() => workstationCatalogue.id, {
      onDelete: 'restrict',
    }),
    machineryId: uuid('machinery_id').references(() => machineryCatalogue.id, {
      onDelete: 'restrict',
    }),
    reference: varchar('reference', { length: 32 }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 32 }).notNull().default('draft'),
  },
  (table) => [
    index('lototo_plans_tenant_id_idx').on(table.tenantId),
    index('lototo_plans_permit_id_idx').on(table.permitId),
    index('lototo_plans_tenant_status_idx').on(table.tenantId, table.status),
    uniqueIndex('lototo_plans_tenant_reference_unique').on(table.tenantId, table.reference),
  ],
);

export const equipmentEnergySources = pgTable(
  'equipment_energy_sources',
  {
    ...auditColumns,
    planId: uuid('plan_id')
      .notNull()
      .references(() => lototoPlans.id, { onDelete: 'cascade' }),
    machineryId: uuid('machinery_id')
      .notNull()
      .references(() => machineryCatalogue.id, { onDelete: 'restrict' }),
    energySourceType: varchar('energy_source_type', { length: 64 }).notNull(),
    description: text('description'),
    lockMethod: varchar('lock_method', { length: 64 }),
    tagType: varchar('tag_type', { length: 64 }),
  },
  (table) => [
    index('equipment_energy_sources_plan_id_idx').on(table.planId),
    index('equipment_energy_sources_machinery_id_idx').on(table.machineryId),
    uniqueIndex('equipment_energy_sources_plan_machinery_type_unique').on(
      table.planId,
      table.machineryId,
      table.energySourceType,
    ),
  ],
);

export const isolationPoints = pgTable(
  'isolation_points',
  {
    ...auditColumns,
    planId: uuid('plan_id')
      .notNull()
      .references(() => lototoPlans.id, { onDelete: 'cascade' }),
    machineryId: uuid('machinery_id')
      .notNull()
      .references(() => machineryCatalogue.id, { onDelete: 'restrict' }),
    equipmentEnergySourceId: uuid('equipment_energy_source_id').references(
      () => equipmentEnergySources.id,
      { onDelete: 'set null' },
    ),
    isolationNumber: varchar('isolation_number', { length: 64 }).notNull(),
    description: text('description'),
    verificationRequired: boolean('verification_required').notNull().default(true),
  },
  (table) => [
    index('isolation_points_plan_id_idx').on(table.planId),
    index('isolation_points_machinery_id_idx').on(table.machineryId),
    uniqueIndex('isolation_points_plan_number_unique').on(
      table.planId,
      table.isolationNumber,
    ),
  ],
);

export const lototoAssignments = pgTable(
  'lototo_assignments',
  {
    ...auditColumns,
    planId: uuid('plan_id')
      .notNull()
      .references(() => lototoPlans.id, { onDelete: 'cascade' }),
    workforceUserId: uuid('workforce_user_id').notNull(),
    role: varchar('role', { length: 64 }).notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('lototo_assignments_plan_id_idx').on(table.planId),
    index('lototo_assignments_workforce_user_id_idx').on(table.workforceUserId),
    uniqueIndex('lototo_assignments_plan_user_role_unique').on(
      table.planId,
      table.workforceUserId,
      table.role,
    ),
  ],
);

export const isolationSequences = pgTable(
  'isolation_sequences',
  {
    ...auditColumns,
    planId: uuid('plan_id')
      .notNull()
      .references(() => lototoPlans.id, { onDelete: 'cascade' }),
    isolationPointId: uuid('isolation_point_id')
      .notNull()
      .references(() => isolationPoints.id, { onDelete: 'cascade' }),
    sequenceOrder: integer('sequence_order').notNull(),
    requiresVerification: boolean('requires_verification').notNull().default(true),
  },
  (table) => [
    index('isolation_sequences_plan_id_idx').on(table.planId),
    uniqueIndex('isolation_sequences_plan_order_unique').on(
      table.planId,
      table.sequenceOrder,
    ),
    uniqueIndex('isolation_sequences_plan_point_unique').on(
      table.planId,
      table.isolationPointId,
    ),
  ],
);
