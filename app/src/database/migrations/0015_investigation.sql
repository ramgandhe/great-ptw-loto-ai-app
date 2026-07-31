CREATE TABLE IF NOT EXISTS "investigations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL,
  "status" varchar(32) DEFAULT 'assigned' NOT NULL,
  "investigator_id" uuid NOT NULL,
  "assigned_by" uuid NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "due_date" date,
  "priority" varchar(32) DEFAULT 'medium' NOT NULL,
  "findings" text DEFAULT '' NOT NULL,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  CONSTRAINT "investigations_incident_id_fk"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT,
  CONSTRAINT "investigations_status_check"
    CHECK ("status" IN ('assigned', 'in_progress', 'completed')),
  CONSTRAINT "investigations_priority_check"
    CHECK ("priority" IN ('low', 'medium', 'high', 'critical'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "investigations_incident_id_unique"
  ON "investigations" ("incident_id");
CREATE INDEX IF NOT EXISTS "investigations_tenant_id_idx"
  ON "investigations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "investigations_tenant_status_idx"
  ON "investigations" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "investigations_investigator_id_idx"
  ON "investigations" ("investigator_id");

CREATE TABLE IF NOT EXISTS "root_causes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "investigation_id" uuid NOT NULL,
  "methodology" varchar(32) DEFAULT '5_why' NOT NULL,
  "description" text NOT NULL,
  "recorded_by" uuid NOT NULL,
  CONSTRAINT "root_causes_investigation_id_fk"
    FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE,
  CONSTRAINT "root_causes_methodology_check"
    CHECK ("methodology" IN ('5_why', 'fishbone', 'fault_tree', 'other'))
);

CREATE INDEX IF NOT EXISTS "root_causes_tenant_id_idx"
  ON "root_causes" ("tenant_id");
CREATE INDEX IF NOT EXISTS "root_causes_investigation_id_idx"
  ON "root_causes" ("investigation_id");

CREATE TABLE IF NOT EXISTS "corrective_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "investigation_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "owner_id" uuid NOT NULL,
  "due_date" date NOT NULL,
  "status" varchar(32) DEFAULT 'open' NOT NULL,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  CONSTRAINT "corrective_actions_investigation_id_fk"
    FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE,
  CONSTRAINT "corrective_actions_status_check"
    CHECK ("status" IN ('open', 'in_progress', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS "corrective_actions_tenant_id_idx"
  ON "corrective_actions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "corrective_actions_investigation_id_idx"
  ON "corrective_actions" ("investigation_id");
CREATE INDEX IF NOT EXISTS "corrective_actions_owner_id_idx"
  ON "corrective_actions" ("owner_id");
CREATE INDEX IF NOT EXISTS "corrective_actions_status_due_idx"
  ON "corrective_actions" ("status", "due_date");

CREATE TABLE IF NOT EXISTS "preventive_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "investigation_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "owner_id" uuid NOT NULL,
  "due_date" date,
  "status" varchar(32) DEFAULT 'open' NOT NULL,
  "completed_at" timestamp with time zone,
  "completed_by" uuid,
  CONSTRAINT "preventive_actions_investigation_id_fk"
    FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE,
  CONSTRAINT "preventive_actions_status_check"
    CHECK ("status" IN ('open', 'in_progress', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS "preventive_actions_tenant_id_idx"
  ON "preventive_actions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "preventive_actions_investigation_id_idx"
  ON "preventive_actions" ("investigation_id");
CREATE INDEX IF NOT EXISTS "preventive_actions_owner_id_idx"
  ON "preventive_actions" ("owner_id");

CREATE TABLE IF NOT EXISTS "investigation_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "investigation_id" uuid NOT NULL,
  "incident_id" uuid NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "actor_id" uuid NOT NULL,
  "payload" jsonb,
  CONSTRAINT "investigation_history_investigation_id_fk"
    FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE,
  CONSTRAINT "investigation_history_incident_id_fk"
    FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT,
  CONSTRAINT "investigation_history_event_type_check"
    CHECK ("event_type" IN (
      'assigned',
      'status_changed',
      'root_cause_recorded',
      'corrective_action_created',
      'corrective_action_updated',
      'preventive_action_created',
      'preventive_action_updated',
      'completed'
    ))
);

CREATE INDEX IF NOT EXISTS "investigation_history_tenant_id_idx"
  ON "investigation_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "investigation_history_investigation_id_idx"
  ON "investigation_history" ("investigation_id");
CREATE INDEX IF NOT EXISTS "investigation_history_incident_created_at_idx"
  ON "investigation_history" ("incident_id", "created_at");

CREATE OR REPLACE FUNCTION prevent_completed_investigation_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'completed' AND TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.investigator_id IS DISTINCT FROM OLD.investigator_id
       OR NEW.findings IS DISTINCT FROM OLD.findings
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.priority IS DISTINCT FROM OLD.priority THEN
      RAISE EXCEPTION 'completed investigation records are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS investigations_completed_immutable ON "investigations";
CREATE TRIGGER investigations_completed_immutable
  BEFORE UPDATE ON "investigations"
  FOR EACH ROW EXECUTE FUNCTION prevent_completed_investigation_mutation();

CREATE OR REPLACE FUNCTION prevent_investigation_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'investigation_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS investigation_history_immutable ON "investigation_history";
CREATE TRIGGER investigation_history_immutable
  BEFORE UPDATE OR DELETE ON "investigation_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_investigation_history_mutation();
