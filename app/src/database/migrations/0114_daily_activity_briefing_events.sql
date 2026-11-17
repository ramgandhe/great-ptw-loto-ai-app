-- Toolbox talk and daily crew events are written by Pause/Resume and were missing from the check.
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
    'evidence_uploaded',
    'toolbox_talk_recorded',
    'daily_crew_updated'
  ));
