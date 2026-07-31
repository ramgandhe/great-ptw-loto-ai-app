CREATE TABLE IF NOT EXISTS "dashboard_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "dashboard_kind" varchar(32) NOT NULL,
  "layout" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "refresh_seconds" integer DEFAULT 60 NOT NULL,
  CONSTRAINT "dashboard_preferences_kind_check"
    CHECK ("dashboard_kind" IN ('personal', 'supervisor', 'safety', 'management')),
  CONSTRAINT "dashboard_preferences_refresh_seconds_check"
    CHECK ("refresh_seconds" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_preferences_tenant_user_kind_unique"
  ON "dashboard_preferences" ("tenant_id", "user_id", "dashboard_kind");
CREATE INDEX IF NOT EXISTS "dashboard_preferences_tenant_id_idx"
  ON "dashboard_preferences" ("tenant_id");
CREATE INDEX IF NOT EXISTS "dashboard_preferences_tenant_user_idx"
  ON "dashboard_preferences" ("tenant_id", "user_id");

CREATE TABLE IF NOT EXISTS "report_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "requested_by" uuid NOT NULL,
  "report_type" varchar(64) NOT NULL,
  "format" varchar(16) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "storage_bucket" varchar(128),
  "storage_key" varchar(512),
  "file_name" varchar(255),
  "content_type" varchar(128),
  "error_message" text,
  "completed_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  CONSTRAINT "report_exports_format_check"
    CHECK ("format" IN ('pdf', 'xlsx', 'csv')),
  CONSTRAINT "report_exports_status_check"
    CHECK ("status" IN ('pending', 'generating', 'ready', 'failed', 'expired'))
);

CREATE INDEX IF NOT EXISTS "report_exports_tenant_id_idx"
  ON "report_exports" ("tenant_id");
CREATE INDEX IF NOT EXISTS "report_exports_tenant_status_idx"
  ON "report_exports" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "report_exports_tenant_requested_by_idx"
  ON "report_exports" ("tenant_id", "requested_by");
CREATE INDEX IF NOT EXISTS "report_exports_created_at_idx"
  ON "report_exports" ("created_at");

CREATE TABLE IF NOT EXISTS "analytics_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "scope" varchar(32) NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "payload" jsonb NOT NULL,
  "source" varchar(64) DEFAULT 'system' NOT NULL,
  CONSTRAINT "analytics_snapshots_scope_check"
    CHECK ("scope" IN ('permits', 'incidents', 'lototo', 'simops', 'operational')),
  CONSTRAINT "analytics_snapshots_period_check"
    CHECK ("period_end" >= "period_start")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_snapshots_tenant_scope_period_unique"
  ON "analytics_snapshots" ("tenant_id", "scope", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "analytics_snapshots_tenant_id_idx"
  ON "analytics_snapshots" ("tenant_id");
CREATE INDEX IF NOT EXISTS "analytics_snapshots_tenant_scope_idx"
  ON "analytics_snapshots" ("tenant_id", "scope");
CREATE INDEX IF NOT EXISTS "analytics_snapshots_tenant_captured_at_idx"
  ON "analytics_snapshots" ("tenant_id", "captured_at");

CREATE TABLE IF NOT EXISTS "kpi_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "kpi_key" varchar(128) NOT NULL,
  "dashboard_kind" varchar(32),
  "period_label" varchar(64) DEFAULT 'current' NOT NULL,
  "value" jsonb NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  CONSTRAINT "kpi_cache_dashboard_kind_check"
    CHECK (
      "dashboard_kind" IS NULL
      OR "dashboard_kind" IN ('personal', 'supervisor', 'safety', 'management')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS "kpi_cache_tenant_key_period_unique"
  ON "kpi_cache" ("tenant_id", "kpi_key", "period_label");
CREATE INDEX IF NOT EXISTS "kpi_cache_tenant_id_idx"
  ON "kpi_cache" ("tenant_id");
CREATE INDEX IF NOT EXISTS "kpi_cache_tenant_kind_idx"
  ON "kpi_cache" ("tenant_id", "dashboard_kind");
CREATE INDEX IF NOT EXISTS "kpi_cache_expires_at_idx"
  ON "kpi_cache" ("expires_at");

-- Historical analytics snapshots are immutable (BR-DSH-006).
CREATE OR REPLACE FUNCTION prevent_analytics_snapshots_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'analytics_snapshots records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS analytics_snapshots_immutable ON "analytics_snapshots";
CREATE TRIGGER analytics_snapshots_immutable
  BEFORE UPDATE OR DELETE ON "analytics_snapshots"
  FOR EACH ROW EXECUTE FUNCTION prevent_analytics_snapshots_mutation();
