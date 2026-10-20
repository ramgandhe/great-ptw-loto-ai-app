ALTER TABLE "permit_status_history" DROP CONSTRAINT IF EXISTS "permit_status_history_action_check";
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
    'expired'
  ));
