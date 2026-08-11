ALTER TABLE "approval_history" DROP CONSTRAINT IF EXISTS "approval_history_action_check";
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_action_check"
  CHECK ("action" IN (
    'submitted',
    'approved',
    'rejected',
    'deferred',
    'stage_advanced',
    'resubmitted',
    'safety_veto',
    'sla_escalated',
    'workflow_blocked'
  ));
