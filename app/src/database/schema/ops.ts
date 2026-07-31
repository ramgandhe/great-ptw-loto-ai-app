import { sql } from 'drizzle-orm';
import {
  bigint,
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

/** Platform backup targets (Implementation Plan §19 / backup procedures). */
export const BACKUP_TARGETS = [
  'postgres',
  'minio',
  'config',
  'keycloak',
] as const;
export type BackupTarget = (typeof BACKUP_TARGETS)[number];

export const BACKUP_RUN_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'verified',
] as const;
export type BackupRunStatus = (typeof BACKUP_RUN_STATUSES)[number];

export const BACKUP_TRIGGERS = ['scheduled', 'manual', 'pre_migrate'] as const;
export type BackupTrigger = (typeof BACKUP_TRIGGERS)[number];

/** Retention entity scopes for archival/purge policy. */
export const RETENTION_ENTITY_TYPES = [
  'audit_logs',
  'notification_history',
  'report_exports',
  'permit_archive',
  'incident_archive',
  'analytics_snapshots',
] as const;
export type RetentionEntityType = (typeof RETENTION_ENTITY_TYPES)[number];

export const RETENTION_ACTIONS = ['archive', 'purge', 'anonymize'] as const;
export type RetentionAction = (typeof RETENTION_ACTIONS)[number];

export const RETENTION_POLICY_STATUSES = ['active', 'disabled'] as const;
export type RetentionPolicyStatus = (typeof RETENTION_POLICY_STATUSES)[number];

export const MIGRATION_RUN_STATUSES = [
  'planned',
  'running',
  'succeeded',
  'failed',
  'rolled_back',
] as const;
export type MigrationRunStatus = (typeof MIGRATION_RUN_STATUSES)[number];

/**
 * Platform backup run metadata — authoritative record of backup/restore
 * validation for production readiness (not tenant business data).
 */
export const backupRuns = pgTable(
  'backup_runs',
  {
    ...auditColumns,
    target: varchar('target', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    trigger: varchar('trigger', { length: 32 }).notNull().default('scheduled'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    storageLocation: text('storage_location'),
    checksum: varchar('checksum', { length: 128 }),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index('backup_runs_target_started_at_idx').on(table.target, table.startedAt),
    index('backup_runs_status_idx').on(table.status),
    index('backup_runs_started_at_idx').on(table.startedAt),
  ],
);

/**
 * Data retention policies — platform default when tenant_id is null;
 * tenant override when tenant_id is set.
 */
export const dataRetentionPolicies = pgTable(
  'data_retention_policies',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id'),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    retentionDays: integer('retention_days').notNull(),
    action: varchar('action', { length: 32 }).notNull().default('archive'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    notes: text('notes'),
  },
  (table) => [
    index('data_retention_policies_tenant_id_idx').on(table.tenantId),
    index('data_retention_policies_entity_type_idx').on(table.entityType),
    uniqueIndex('data_retention_policies_platform_entity_unique')
      .on(table.entityType)
      .where(sql`"tenant_id" IS NULL`),
    uniqueIndex('data_retention_policies_tenant_entity_unique')
      .on(table.tenantId, table.entityType)
      .where(sql`"tenant_id" IS NOT NULL`),
  ],
);

/**
 * Go-live / production migration execution log — append-oriented sequencing
 * record for migration dry-runs and production apply steps.
 */
export const migrationRunLog = pgTable(
  'migration_run_log',
  {
    ...auditColumns,
    environment: varchar('environment', { length: 32 }).notNull(),
    migrationTag: varchar('migration_tag', { length: 128 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('planned'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    executedBy: uuid('executed_by'),
    checksum: varchar('checksum', { length: 128 }),
    notes: text('notes'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index('migration_run_log_environment_idx').on(table.environment),
    index('migration_run_log_migration_tag_idx').on(table.migrationTag),
    index('migration_run_log_started_at_idx').on(table.startedAt),
  ],
);
