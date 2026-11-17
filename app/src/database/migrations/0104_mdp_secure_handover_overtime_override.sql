-- Slice A6: day secure, dual-acceptance handover columns, overtime, override events.

CREATE TABLE IF NOT EXISTS "permit_day_secures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "operational_date" date NOT NULL,
  "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "personnel_cleared" boolean DEFAULT false NOT NULL,
  "late" boolean DEFAULT false NOT NULL,
  "late_reason" text,
  "secured_by" uuid NOT NULL,
  "secured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "countersigned_by" uuid,
  "countersigned_at" timestamp with time zone,
  "status" varchar(32) DEFAULT 'submitted' NOT NULL,
  CONSTRAINT "permit_day_secures_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_day_secures_status_check"
    CHECK ("status" IN ('submitted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permit_day_secures_tenant_permit_day_unique"
  ON "permit_day_secures" ("tenant_id", "permit_id", "operational_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_day_secures_tenant_permit_idx"
  ON "permit_day_secures" ("tenant_id", "permit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_day_secures_permit_day_idx"
  ON "permit_day_secures" ("permit_id", "operational_date");
--> statement-breakpoint

ALTER TABLE "shift_handovers"
  ADD COLUMN IF NOT EXISTS "accepted_by" uuid;
--> statement-breakpoint
ALTER TABLE "shift_handovers"
  ADD COLUMN IF NOT EXISTS "accepted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shift_handovers"
  ADD COLUMN IF NOT EXISTS "acceptance_notes" text DEFAULT '' NOT NULL;
--> statement-breakpoint

ALTER TABLE "shift_handovers" DROP CONSTRAINT IF EXISTS "shift_handovers_status_check";
--> statement-breakpoint
ALTER TABLE "shift_handovers"
  ADD CONSTRAINT "shift_handovers_status_check"
  CHECK ("status" IN ('pending_acceptance', 'accepted', 'rejected', 'submitted'));
--> statement-breakpoint
ALTER TABLE "shift_handovers" ALTER COLUMN "status" SET DEFAULT 'pending_acceptance';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_handovers_status_idx" ON "shift_handovers" ("status");
--> statement-breakpoint

-- Disable immutable trigger so legacy backfill can rewrite status.
ALTER TABLE "shift_handovers" DISABLE TRIGGER "shift_handovers_immutable";
--> statement-breakpoint

-- Legacy one-way handovers become accepted (Slice E legacy path).
UPDATE "shift_handovers"
SET
  "status" = 'accepted',
  "accepted_by" = COALESCE("accepted_by", "incoming_user_id"),
  "accepted_at" = COALESCE("accepted_at", "handed_over_at")
WHERE "status" = 'submitted';
--> statement-breakpoint

-- Allow acceptance transitions; keep content immutable.
CREATE OR REPLACE FUNCTION prevent_shift_handover_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'shift_handovers records are immutable';
  END IF;

  IF OLD.status = 'pending_acceptance'
     AND NEW.status IN ('accepted', 'rejected')
     AND OLD.tenant_id IS NOT DISTINCT FROM NEW.tenant_id
     AND OLD.permit_id IS NOT DISTINCT FROM NEW.permit_id
     AND OLD.daily_progress_id IS NOT DISTINCT FROM NEW.daily_progress_id
     AND OLD.outgoing_user_id IS NOT DISTINCT FROM NEW.outgoing_user_id
     AND OLD.incoming_user_id IS NOT DISTINCT FROM NEW.incoming_user_id
     AND OLD.completed_activities IS NOT DISTINCT FROM NEW.completed_activities
     AND OLD.outstanding_work IS NOT DISTINCT FROM NEW.outstanding_work
     AND OLD.safety_observations IS NOT DISTINCT FROM NEW.safety_observations
     AND OLD.handed_over_at IS NOT DISTINCT FROM NEW.handed_over_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'shift_handovers records are immutable except for acceptance';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

ALTER TABLE "shift_handovers" ENABLE TRIGGER "shift_handovers_immutable";
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "permit_overtime_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "operational_date" date NOT NULL,
  "requested_until" timestamp with time zone NOT NULL,
  "justification" text NOT NULL,
  "status" varchar(16) DEFAULT 'pending' NOT NULL,
  "requested_by" uuid NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  "decision_comments" text,
  CONSTRAINT "permit_overtime_requests_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "permit_overtime_requests_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_overtime_requests_tenant_permit_idx"
  ON "permit_overtime_requests" ("tenant_id", "permit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_overtime_requests_status_idx"
  ON "permit_overtime_requests" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_overtime_requests_permit_day_idx"
  ON "permit_overtime_requests" ("permit_id", "operational_date");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "permit_mdp_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "operational_date" date NOT NULL,
  "reason" text NOT NULL,
  "overridden_by" uuid NOT NULL,
  "overridden_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "permit_mdp_overrides_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permit_mdp_overrides_tenant_permit_day_unique"
  ON "permit_mdp_overrides" ("tenant_id", "permit_id", "operational_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_mdp_overrides_tenant_permit_idx"
  ON "permit_mdp_overrides" ("tenant_id", "permit_id");
