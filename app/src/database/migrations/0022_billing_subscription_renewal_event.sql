-- PUS-248 / FR-BIL-005: allow subscription renewal notification events
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_event_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_check"
  CHECK ("event_type" IN (
    'permit_submitted',
    'permit_approved',
    'permit_rejected',
    'permit_deferred',
    'permit_expiry',
    'incident_reported',
    'simops_conflict',
    'lototo_verification',
    'task_reminder',
    'escalation',
    'subscription_renewal'
  ));
