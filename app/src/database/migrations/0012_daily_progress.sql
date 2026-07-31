CREATE TABLE IF NOT EXISTS "permit_daily_progress" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "operational_date" date NOT NULL,
  "completed_work" text NOT NULL,
  "pending_work" text DEFAULT '' NOT NULL,
  "summary" text NOT NULL,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "recorded_by" uuid NOT NULL,
  "submitted_by" uuid,
  "submitted_at" timestamp with time zone,
  "attachment_meta" jsonb,
  CONSTRAINT "permit_daily_progress_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_daily_progress_status_check"
    CHECK ("status" IN ('draft', 'submitted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_daily_progress_tenant_permit_day_unique"
  ON "permit_daily_progress" ("tenant_id", "permit_id", "operational_date");
CREATE INDEX IF NOT EXISTS "permit_daily_progress_tenant_permit_idx"
  ON "permit_daily_progress" ("tenant_id", "permit_id");
CREATE INDEX IF NOT EXISTS "permit_daily_progress_permit_day_idx"
  ON "permit_daily_progress" ("permit_id", "operational_date");

CREATE TABLE IF NOT EXISTS "shift_handovers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "daily_progress_id" uuid,
  "outgoing_user_id" uuid NOT NULL,
  "incoming_user_id" uuid NOT NULL,
  "completed_activities" text NOT NULL,
  "outstanding_work" text NOT NULL,
  "safety_observations" text DEFAULT '' NOT NULL,
  "handed_over_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" varchar(32) DEFAULT 'submitted' NOT NULL,
  CONSTRAINT "shift_handovers_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "shift_handovers_daily_progress_id_fk"
    FOREIGN KEY ("daily_progress_id") REFERENCES "permit_daily_progress"("id") ON DELETE SET NULL,
  CONSTRAINT "shift_handovers_status_check"
    CHECK ("status" IN ('submitted'))
);

CREATE INDEX IF NOT EXISTS "shift_handovers_tenant_permit_idx"
  ON "shift_handovers" ("tenant_id", "permit_id");
CREATE INDEX IF NOT EXISTS "shift_handovers_permit_handed_over_at_idx"
  ON "shift_handovers" ("permit_id", "handed_over_at");
CREATE INDEX IF NOT EXISTS "shift_handovers_daily_progress_id_idx"
  ON "shift_handovers" ("daily_progress_id");

CREATE TABLE IF NOT EXISTS "daily_activity_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "actor_id" uuid NOT NULL,
  "payload" jsonb,
  CONSTRAINT "daily_activity_history_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "daily_activity_history_event_type_check"
    CHECK ("event_type" IN ('progress_recorded', 'progress_submitted', 'handover_completed'))
);

CREATE INDEX IF NOT EXISTS "daily_activity_history_tenant_permit_idx"
  ON "daily_activity_history" ("tenant_id", "permit_id");
CREATE INDEX IF NOT EXISTS "daily_activity_history_permit_created_at_idx"
  ON "daily_activity_history" ("permit_id", "created_at");

CREATE OR REPLACE FUNCTION prevent_submitted_daily_progress_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'submitted permit_daily_progress records are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'submitted permit_daily_progress records are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_daily_progress_submitted_immutable ON "permit_daily_progress";
CREATE TRIGGER permit_daily_progress_submitted_immutable
  BEFORE UPDATE OR DELETE ON "permit_daily_progress"
  FOR EACH ROW EXECUTE FUNCTION prevent_submitted_daily_progress_mutation();

CREATE OR REPLACE FUNCTION prevent_shift_handover_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'shift_handovers records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shift_handovers_immutable ON "shift_handovers";
CREATE TRIGGER shift_handovers_immutable
  BEFORE UPDATE OR DELETE ON "shift_handovers"
  FOR EACH ROW EXECUTE FUNCTION prevent_shift_handover_mutation();

CREATE OR REPLACE FUNCTION prevent_daily_activity_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'daily_activity_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_activity_history_immutable ON "daily_activity_history";
CREATE TRIGGER daily_activity_history_immutable
  BEFORE UPDATE OR DELETE ON "daily_activity_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_daily_activity_history_mutation();
