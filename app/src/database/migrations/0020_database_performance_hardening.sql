-- SP-08.02: hot-path composite indexes for tenant-scoped list/filter queries.

CREATE INDEX IF NOT EXISTS "permits_tenant_created_by_status_idx"
  ON "permits" ("tenant_id", "created_by", "status");

CREATE INDEX IF NOT EXISTS "permits_tenant_planned_end_at_idx"
  ON "permits" ("tenant_id", "planned_end_at");

CREATE INDEX IF NOT EXISTS "incidents_tenant_occurred_at_idx"
  ON "incidents" ("tenant_id", "occurred_at");

CREATE INDEX IF NOT EXISTS "notification_recipients_tenant_user_read_idx"
  ON "notification_recipients" ("tenant_id", "user_id", "read_at");

CREATE INDEX IF NOT EXISTS "audit_logs_tenant_created_at_idx"
  ON "audit_logs" ("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "report_exports_tenant_created_at_idx"
  ON "report_exports" ("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "billing_invoices_tenant_created_at_idx"
  ON "billing_invoices" ("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "tenant_subscriptions_tenant_renew_at_idx"
  ON "tenant_subscriptions" ("tenant_id", "renew_at");
