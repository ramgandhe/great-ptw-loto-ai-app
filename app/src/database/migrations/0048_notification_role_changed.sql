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
    'role_changed'
  ));
