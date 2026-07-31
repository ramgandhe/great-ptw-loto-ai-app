CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "billing_interval" varchar(16) NOT NULL,
  "price_minor" integer DEFAULT 0 NOT NULL,
  "currency" varchar(3) DEFAULT 'INR' NOT NULL,
  "enabled_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "usage_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "description" text,
  CONSTRAINT "subscription_plans_billing_interval_check"
    CHECK ("billing_interval" IN ('monthly', 'yearly')),
  CONSTRAINT "subscription_plans_status_check"
    CHECK ("status" IN ('active', 'retired')),
  CONSTRAINT "subscription_plans_price_minor_check"
    CHECK ("price_minor" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_code_unique"
  ON "subscription_plans" ("code");
CREATE INDEX IF NOT EXISTS "subscription_plans_status_idx"
  ON "subscription_plans" ("status");

CREATE TABLE IF NOT EXISTS "tenant_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "subscription_plans"("id") ON DELETE RESTRICT,
  "status" varchar(32) DEFAULT 'trial' NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "renew_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  CONSTRAINT "tenant_subscriptions_status_check"
    CHECK ("status" IN ('trial', 'active', 'past_due', 'cancelled', 'suspended')),
  CONSTRAINT "tenant_subscriptions_period_check"
    CHECK ("period_end" >= "period_start")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_subscriptions_one_open_per_tenant"
  ON "tenant_subscriptions" ("tenant_id")
  WHERE "status" IN ('trial', 'active', 'past_due', 'suspended');
CREATE INDEX IF NOT EXISTS "tenant_subscriptions_tenant_id_idx"
  ON "tenant_subscriptions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_subscriptions_tenant_status_idx"
  ON "tenant_subscriptions" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "tenant_subscriptions_plan_id_idx"
  ON "tenant_subscriptions" ("plan_id");
CREATE INDEX IF NOT EXISTS "tenant_subscriptions_renew_at_idx"
  ON "tenant_subscriptions" ("renew_at");

CREATE TABLE IF NOT EXISTS "usage_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "metric_key" varchar(128) NOT NULL,
  "quantity" bigint DEFAULT 0 NOT NULL,
  "period_label" varchar(64) NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "usage_records_quantity_check"
    CHECK ("quantity" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "usage_records_tenant_metric_period_unique"
  ON "usage_records" ("tenant_id", "metric_key", "period_label");
CREATE INDEX IF NOT EXISTS "usage_records_tenant_id_idx"
  ON "usage_records" ("tenant_id");
CREATE INDEX IF NOT EXISTS "usage_records_tenant_metric_idx"
  ON "usage_records" ("tenant_id", "metric_key");
CREATE INDEX IF NOT EXISTS "usage_records_recorded_at_idx"
  ON "usage_records" ("recorded_at");

CREATE TABLE IF NOT EXISTS "billing_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "subscription_id" uuid NOT NULL REFERENCES "tenant_subscriptions"("id") ON DELETE RESTRICT,
  "invoice_number" varchar(64) NOT NULL,
  "amount_minor" integer DEFAULT 0 NOT NULL,
  "currency" varchar(3) DEFAULT 'INR' NOT NULL,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "due_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  CONSTRAINT "billing_invoices_status_check"
    CHECK ("status" IN ('draft', 'issued', 'paid', 'void')),
  CONSTRAINT "billing_invoices_amount_minor_check"
    CHECK ("amount_minor" >= 0),
  CONSTRAINT "billing_invoices_period_check"
    CHECK ("period_end" >= "period_start")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_invoices_invoice_number_unique"
  ON "billing_invoices" ("invoice_number");
CREATE INDEX IF NOT EXISTS "billing_invoices_tenant_id_idx"
  ON "billing_invoices" ("tenant_id");
CREATE INDEX IF NOT EXISTS "billing_invoices_tenant_status_idx"
  ON "billing_invoices" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "billing_invoices_subscription_id_idx"
  ON "billing_invoices" ("subscription_id");

CREATE TABLE IF NOT EXISTS "plan_change_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "subscription_id" uuid NOT NULL REFERENCES "tenant_subscriptions"("id") ON DELETE RESTRICT,
  "from_plan_id" uuid REFERENCES "subscription_plans"("id") ON DELETE RESTRICT,
  "to_plan_id" uuid NOT NULL REFERENCES "subscription_plans"("id") ON DELETE RESTRICT,
  "changed_by" uuid NOT NULL,
  "reason" text,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "plan_change_history_tenant_id_idx"
  ON "plan_change_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "plan_change_history_subscription_id_idx"
  ON "plan_change_history" ("subscription_id");
CREATE INDEX IF NOT EXISTS "plan_change_history_changed_at_idx"
  ON "plan_change_history" ("changed_at");

-- Plan change history is append-only.
CREATE OR REPLACE FUNCTION prevent_plan_change_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'plan_change_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plan_change_history_immutable ON "plan_change_history";
CREATE TRIGGER plan_change_history_immutable
  BEFORE UPDATE OR DELETE ON "plan_change_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_plan_change_history_mutation();
