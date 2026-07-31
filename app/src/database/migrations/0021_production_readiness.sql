-- SP-08.03: production readiness ops tables (backup metadata, retention, migration log).

CREATE TABLE IF NOT EXISTS "backup_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "target" varchar(32) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "trigger" varchar(32) DEFAULT 'scheduled' NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "storage_location" text,
  "checksum" varchar(128),
  "size_bytes" bigint,
  "error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "backup_runs_target_check"
    CHECK ("target" IN ('postgres', 'minio', 'config', 'keycloak')),
  CONSTRAINT "backup_runs_status_check"
    CHECK ("status" IN ('pending', 'running', 'succeeded', 'failed', 'verified')),
  CONSTRAINT "backup_runs_trigger_check"
    CHECK ("trigger" IN ('scheduled', 'manual', 'pre_migrate'))
);

CREATE INDEX IF NOT EXISTS "backup_runs_target_started_at_idx"
  ON "backup_runs" ("target", "started_at");
CREATE INDEX IF NOT EXISTS "backup_runs_status_idx"
  ON "backup_runs" ("status");
CREATE INDEX IF NOT EXISTS "backup_runs_started_at_idx"
  ON "backup_runs" ("started_at");

CREATE TABLE IF NOT EXISTS "data_retention_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid,
  "entity_type" varchar(64) NOT NULL,
  "retention_days" integer NOT NULL,
  "action" varchar(32) DEFAULT 'archive' NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "notes" text,
  CONSTRAINT "data_retention_policies_entity_type_check"
    CHECK ("entity_type" IN (
      'audit_logs',
      'notification_history',
      'report_exports',
      'permit_archive',
      'incident_archive',
      'analytics_snapshots'
    )),
  CONSTRAINT "data_retention_policies_action_check"
    CHECK ("action" IN ('archive', 'purge', 'anonymize')),
  CONSTRAINT "data_retention_policies_status_check"
    CHECK ("status" IN ('active', 'disabled')),
  CONSTRAINT "data_retention_policies_retention_days_check"
    CHECK ("retention_days" > 0)
);

CREATE INDEX IF NOT EXISTS "data_retention_policies_tenant_id_idx"
  ON "data_retention_policies" ("tenant_id");
CREATE INDEX IF NOT EXISTS "data_retention_policies_entity_type_idx"
  ON "data_retention_policies" ("entity_type");
CREATE UNIQUE INDEX IF NOT EXISTS "data_retention_policies_platform_entity_unique"
  ON "data_retention_policies" ("entity_type")
  WHERE "tenant_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "data_retention_policies_tenant_entity_unique"
  ON "data_retention_policies" ("tenant_id", "entity_type")
  WHERE "tenant_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "migration_run_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "environment" varchar(32) NOT NULL,
  "migration_tag" varchar(128) NOT NULL,
  "status" varchar(32) DEFAULT 'planned' NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "executed_by" uuid,
  "checksum" varchar(128),
  "notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "migration_run_log_status_check"
    CHECK ("status" IN ('planned', 'running', 'succeeded', 'failed', 'rolled_back'))
);

CREATE INDEX IF NOT EXISTS "migration_run_log_environment_idx"
  ON "migration_run_log" ("environment");
CREATE INDEX IF NOT EXISTS "migration_run_log_migration_tag_idx"
  ON "migration_run_log" ("migration_tag");
CREATE INDEX IF NOT EXISTS "migration_run_log_started_at_idx"
  ON "migration_run_log" ("started_at");
