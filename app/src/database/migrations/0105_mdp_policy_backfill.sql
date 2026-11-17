-- Slice A7: explicit one-time backfill of MDP policy defaults on existing permits.
-- Safe before approval UI (A10) can set per-permit overrides. Runs once via migrate journal.
UPDATE "permits"
SET
  "daily_revalidation_required" = true,
  "emergency_override_allowed" = true
WHERE "daily_revalidation_required" IS DISTINCT FROM true
   OR "emergency_override_allowed" IS DISTINCT FROM true;
--> statement-breakpoint

-- Ensure organisation MDP settings stay populated (idempotent with 0102 defaults).
UPDATE "organisations"
SET
  "max_multi_day_validity_days" = COALESCE("max_multi_day_validity_days", 7),
  "operational_day_cutoff" = COALESCE("operational_day_cutoff", '16:30'),
  "overtime_approver_role" = COALESCE("overtime_approver_role", 'permit-approver')
WHERE "max_multi_day_validity_days" IS NULL
   OR "operational_day_cutoff" IS NULL
   OR "overtime_approver_role" IS NULL;
