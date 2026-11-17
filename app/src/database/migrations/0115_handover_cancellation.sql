ALTER TABLE "shift_handovers" DROP CONSTRAINT IF EXISTS "shift_handovers_status_check";
--> statement-breakpoint
ALTER TABLE "shift_handovers"
  ADD CONSTRAINT "shift_handovers_status_check"
  CHECK ("status" IN ('pending_acceptance', 'accepted', 'rejected', 'cancelled', 'submitted'));
--> statement-breakpoint

CREATE OR REPLACE FUNCTION prevent_shift_handover_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'shift_handovers records are immutable';
  END IF;

  IF OLD.status = 'pending_acceptance'
     AND NEW.status IN ('accepted', 'rejected', 'cancelled')
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

  RAISE EXCEPTION 'shift_handovers records are immutable except for acceptance or cancellation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

ALTER TABLE "daily_activity_history" DROP CONSTRAINT IF EXISTS "daily_activity_history_event_type_check";
--> statement-breakpoint
ALTER TABLE "daily_activity_history"
  ADD CONSTRAINT "daily_activity_history_event_type_check"
  CHECK ("event_type" IN (
    'progress_recorded',
    'progress_submitted',
    'handover_completed',
    'handover_accepted',
    'handover_rejected',
    'handover_cancelled',
    'day_secured',
    'late_secure_recorded',
    'day_secure_countersigned',
    'evidence_uploaded',
    'toolbox_talk_recorded',
    'daily_crew_updated'
  ));
