-- Slice B4: pending countersign status + activity/history event for countersign.
-- Also aligns daily_activity_history event types with schema (secure + handover accept).

ALTER TABLE "permit_day_secures" DROP CONSTRAINT IF EXISTS "permit_day_secures_status_check";
--> statement-breakpoint
ALTER TABLE "permit_day_secures" ADD CONSTRAINT "permit_day_secures_status_check"
  CHECK ("status" IN ('pending_countersign', 'submitted'));
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
    'day_secure_countersigned'
  ));
