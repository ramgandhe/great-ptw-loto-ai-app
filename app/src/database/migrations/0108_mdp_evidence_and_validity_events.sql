-- Slice I: MDP evidence (FR-MDP-007) + max-validity / day-cycle reminder history events.

CREATE TABLE IF NOT EXISTS "mdp_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "kind" varchar(32) NOT NULL,
  "operational_date" date,
  "daily_progress_id" uuid,
  "day_secure_id" uuid,
  "revalidation_id" uuid,
  "file_name" varchar(255) NOT NULL,
  "content_type" varchar(128) NOT NULL,
  "file_size" integer NOT NULL,
  "storage_bucket" varchar(128) NOT NULL,
  "storage_key" varchar(512) NOT NULL,
  "comment" text,
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mdp_evidence_permit_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE,
  CONSTRAINT "mdp_evidence_daily_progress_id_fk"
    FOREIGN KEY ("daily_progress_id") REFERENCES "permit_daily_progress"("id") ON DELETE SET NULL,
  CONSTRAINT "mdp_evidence_day_secure_id_fk"
    FOREIGN KEY ("day_secure_id") REFERENCES "permit_day_secures"("id") ON DELETE SET NULL,
  CONSTRAINT "mdp_evidence_kind_check"
    CHECK ("kind" IN ('daily_progress', 'day_secure', 'reopen'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mdp_evidence_tenant_permit_idx"
  ON "mdp_evidence" ("tenant_id", "permit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mdp_evidence_permit_kind_idx"
  ON "mdp_evidence" ("permit_id", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mdp_evidence_daily_progress_id_idx"
  ON "mdp_evidence" ("daily_progress_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mdp_evidence_day_secure_id_idx"
  ON "mdp_evidence" ("day_secure_id");
--> statement-breakpoint

ALTER TABLE "revalidation_history" DROP CONSTRAINT IF EXISTS "revalidation_history_event_type_check";
--> statement-breakpoint
ALTER TABLE "revalidation_history" ADD CONSTRAINT "revalidation_history_event_type_check"
  CHECK ("event_type" IN (
    'revalidation_passed',
    'revalidation_failed',
    'permit_continued',
    'permit_cleared',
    'permit_suspended',
    'extension_requested',
    'extension_approved',
    'extension_rejected',
    'overtime_requested',
    'overtime_approved',
    'overtime_rejected',
    'override_used',
    'day_secured',
    'late_secure_recorded',
    'validity_expired',
    'renewal_due_notified',
    'max_validity_due_notified',
    'renewal_initiated',
    'clear_day_expired',
    'failed_reopen',
    'secure_due_reminder',
    'reopen_due_reminder',
    'late_secure_reminder',
    'evidence_uploaded'
  ));
--> statement-breakpoint

ALTER TABLE "daily_activity_history" DROP CONSTRAINT IF EXISTS "daily_activity_history_event_type_check";
--> statement-breakpoint
ALTER TABLE "daily_activity_history" ADD CONSTRAINT "daily_activity_history_event_type_check"
  CHECK ("event_type" IN (
    'progress_recorded',
    'progress_submitted',
    'handover_completed',
    'handover_accepted',
    'handover_rejected',
    'day_secured',
    'late_secure_recorded',
    'day_secure_countersigned',
    'evidence_uploaded'
  ));
