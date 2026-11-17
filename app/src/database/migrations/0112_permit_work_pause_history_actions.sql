-- Allow work pause/resume events on permit_status_history (locked Work loop).
ALTER TABLE "permit_status_history" DROP CONSTRAINT IF EXISTS "permit_status_history_action_check";
--> statement-breakpoint
ALTER TABLE "permit_status_history" ADD CONSTRAINT "permit_status_history_action_check"
  CHECK ("action" IN (
    'execution_released',
    'activated',
    'suspended',
    'resumed',
    'revalidated',
    'verified',
    'execution_completed',
    'sent_back',
    'closed',
    'cancelled',
    'expired',
    'work_paused',
    'work_resumed'
  ));
