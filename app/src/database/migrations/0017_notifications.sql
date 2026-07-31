CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "category" varchar(32) NOT NULL,
  "priority" varchar(32) DEFAULT 'medium' NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "entity_type" varchar(64),
  "entity_id" uuid,
  "dedupe_key" varchar(255),
  "source_module" varchar(64),
  CONSTRAINT "notifications_event_type_check"
    CHECK ("event_type" IN (
      'permit_submitted',
      'permit_approved',
      'permit_rejected',
      'permit_deferred',
      'permit_expiry',
      'incident_reported',
      'simops_conflict',
      'lototo_verification',
      'task_reminder',
      'escalation'
    )),
  CONSTRAINT "notifications_category_check"
    CHECK ("category" IN ('workflow', 'reminder', 'escalation', 'system')),
  CONSTRAINT "notifications_priority_check"
    CHECK ("priority" IN ('low', 'medium', 'high', 'critical'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_tenant_dedupe_key_unique"
  ON "notifications" ("tenant_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "notifications_tenant_id_idx"
  ON "notifications" ("tenant_id");
CREATE INDEX IF NOT EXISTS "notifications_tenant_event_type_idx"
  ON "notifications" ("tenant_id", "event_type");
CREATE INDEX IF NOT EXISTS "notifications_tenant_category_idx"
  ON "notifications" ("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "notifications_tenant_created_at_idx"
  ON "notifications" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_entity_idx"
  ON "notifications" ("entity_type", "entity_id");

CREATE TABLE IF NOT EXISTS "notification_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "channel" varchar(32) DEFAULT 'in_app' NOT NULL,
  "delivery_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "read_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "failure_reason" text,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "next_retry_at" timestamp with time zone,
  CONSTRAINT "notification_recipients_notification_id_fk"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT,
  CONSTRAINT "notification_recipients_channel_check"
    CHECK ("channel" IN ('in_app', 'email', 'push')),
  CONSTRAINT "notification_recipients_delivery_status_check"
    CHECK ("delivery_status" IN ('pending', 'delivered', 'failed', 'suppressed')),
  CONSTRAINT "notification_recipients_retry_count_check"
    CHECK ("retry_count" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_recipients_notification_user_channel_unique"
  ON "notification_recipients" ("notification_id", "user_id", "channel");
CREATE INDEX IF NOT EXISTS "notification_recipients_tenant_id_idx"
  ON "notification_recipients" ("tenant_id");
CREATE INDEX IF NOT EXISTS "notification_recipients_tenant_user_idx"
  ON "notification_recipients" ("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "notification_recipients_tenant_status_idx"
  ON "notification_recipients" ("tenant_id", "delivery_status");
CREATE INDEX IF NOT EXISTS "notification_recipients_next_retry_at_idx"
  ON "notification_recipients" ("next_retry_at");

CREATE TABLE IF NOT EXISTS "notification_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "recipient_id" uuid NOT NULL,
  "action" varchar(32) NOT NULL,
  "detail" text,
  CONSTRAINT "notification_history_notification_id_fk"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT,
  CONSTRAINT "notification_history_recipient_id_fk"
    FOREIGN KEY ("recipient_id") REFERENCES "notification_recipients"("id") ON DELETE RESTRICT,
  CONSTRAINT "notification_history_action_check"
    CHECK ("action" IN (
      'created',
      'queued',
      'delivered',
      'failed',
      'retried',
      'read',
      'escalated'
    ))
);

CREATE INDEX IF NOT EXISTS "notification_history_tenant_id_idx"
  ON "notification_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "notification_history_notification_id_idx"
  ON "notification_history" ("notification_id");
CREATE INDEX IF NOT EXISTS "notification_history_recipient_id_idx"
  ON "notification_history" ("recipient_id");
CREATE INDEX IF NOT EXISTS "notification_history_tenant_action_idx"
  ON "notification_history" ("tenant_id", "action");

-- BR-NTF-004: notification history remains immutable.
CREATE OR REPLACE FUNCTION prevent_notification_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'notification_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_history_immutable ON "notification_history";
CREATE TRIGGER notification_history_immutable
  BEFORE UPDATE OR DELETE ON "notification_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_notification_history_mutation();
