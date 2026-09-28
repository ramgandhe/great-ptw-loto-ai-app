ALTER TABLE "permit_status_history" DROP CONSTRAINT IF EXISTS "permit_status_history_action_check";
ALTER TABLE "permit_status_history" ADD CONSTRAINT "permit_status_history_action_check"
  CHECK ("action" IN (
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

-- Permits expired by the validity job before expiry was logged get their missing history row,
-- so every status change appears in the permit's journey.
INSERT INTO "permit_status_history" ("permit_id", "action", "from_status", "to_status", "actor_id", "created_by", "created_at", "metadata")
SELECT p."id",
  'expired',
  COALESCE(
    (SELECT h."to_status" FROM "permit_status_history" h
     WHERE h."permit_id" = p."id" ORDER BY h."created_at" DESC LIMIT 1),
    'active'
  ),
  'expired',
  COALESCE(p."submitted_by", p."tenant_id"),
  COALESCE(p."submitted_by", p."tenant_id"),
  p."updated_at",
  '{"system": true, "backfilled": true}'::jsonb
FROM "permits" p
WHERE p."status" = 'expired'
  AND NOT EXISTS (
    SELECT 1 FROM "permit_status_history" h
    WHERE h."permit_id" = p."id" AND h."to_status" = 'expired'
  );
