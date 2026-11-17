-- Slice C: expand MDP suspension sources + revalidation history for clear/day-transition.

ALTER TABLE "permit_suspensions" DROP CONSTRAINT IF EXISTS "permit_suspensions_source_check";
--> statement-breakpoint
ALTER TABLE "permit_suspensions" ADD CONSTRAINT "permit_suspensions_source_check"
  CHECK ("source" IN ('manual', 'failed_revalidation', 'execution', 'simops', 'incident'));
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
    'renewal_initiated',
    'clear_day_expired',
    'failed_reopen'
  ));
