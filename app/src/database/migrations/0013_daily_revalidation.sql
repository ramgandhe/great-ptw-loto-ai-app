CREATE TABLE IF NOT EXISTS "permit_revalidations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "operational_date" date NOT NULL,
  "outcome" varchar(16) NOT NULL,
  "checklist" jsonb,
  "findings" text NOT NULL,
  "revalidated_by" uuid NOT NULL,
  "revalidated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "permit_revalidations_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_revalidations_outcome_check"
    CHECK ("outcome" IN ('passed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_revalidations_tenant_permit_day_unique"
  ON "permit_revalidations" ("tenant_id", "permit_id", "operational_date");
CREATE INDEX IF NOT EXISTS "permit_revalidations_tenant_permit_idx"
  ON "permit_revalidations" ("tenant_id", "permit_id");
CREATE INDEX IF NOT EXISTS "permit_revalidations_permit_day_idx"
  ON "permit_revalidations" ("permit_id", "operational_date");

CREATE TABLE IF NOT EXISTS "permit_extensions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "requested_end_at" timestamp with time zone NOT NULL,
  "previous_end_at" timestamp with time zone,
  "justification" text NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "requested_by" uuid NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  "decision_comments" text,
  CONSTRAINT "permit_extensions_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_extensions_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS "permit_extensions_tenant_permit_idx"
  ON "permit_extensions" ("tenant_id", "permit_id");
CREATE INDEX IF NOT EXISTS "permit_extensions_status_idx"
  ON "permit_extensions" ("status");

CREATE TABLE IF NOT EXISTS "permit_suspensions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "suspended_by" uuid NOT NULL,
  "suspended_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resumed_by" uuid,
  "resumed_at" timestamp with time zone,
  "source" varchar(32) DEFAULT 'manual' NOT NULL,
  CONSTRAINT "permit_suspensions_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_suspensions_source_check"
    CHECK ("source" IN ('manual', 'failed_revalidation'))
);

CREATE INDEX IF NOT EXISTS "permit_suspensions_tenant_permit_idx"
  ON "permit_suspensions" ("tenant_id", "permit_id");
CREATE INDEX IF NOT EXISTS "permit_suspensions_permit_suspended_at_idx"
  ON "permit_suspensions" ("permit_id", "suspended_at");

CREATE TABLE IF NOT EXISTS "revalidation_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "actor_id" uuid NOT NULL,
  "payload" jsonb,
  CONSTRAINT "revalidation_history_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "revalidation_history_event_type_check"
    CHECK ("event_type" IN (
      'revalidation_passed',
      'revalidation_failed',
      'permit_continued',
      'permit_suspended',
      'extension_requested',
      'extension_approved',
      'extension_rejected'
    ))
);

CREATE INDEX IF NOT EXISTS "revalidation_history_tenant_permit_idx"
  ON "revalidation_history" ("tenant_id", "permit_id");
CREATE INDEX IF NOT EXISTS "revalidation_history_permit_created_at_idx"
  ON "revalidation_history" ("permit_id", "created_at");

CREATE OR REPLACE FUNCTION prevent_permit_revalidation_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'permit_revalidations records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_revalidations_immutable ON "permit_revalidations";
CREATE TRIGGER permit_revalidations_immutable
  BEFORE UPDATE OR DELETE ON "permit_revalidations"
  FOR EACH ROW EXECUTE FUNCTION prevent_permit_revalidation_mutation();

CREATE OR REPLACE FUNCTION prevent_decided_extension_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'decided permit_extensions records are immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'decided permit_extensions records are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS permit_extensions_decided_immutable ON "permit_extensions";
CREATE TRIGGER permit_extensions_decided_immutable
  BEFORE UPDATE OR DELETE ON "permit_extensions"
  FOR EACH ROW EXECUTE FUNCTION prevent_decided_extension_mutation();

CREATE OR REPLACE FUNCTION prevent_revalidation_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'revalidation_history records are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS revalidation_history_immutable ON "revalidation_history";
CREATE TRIGGER revalidation_history_immutable
  BEFORE UPDATE OR DELETE ON "revalidation_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_revalidation_history_mutation();
