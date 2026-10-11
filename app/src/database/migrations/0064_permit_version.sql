ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "permit_version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "permit_version_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "approved_at" timestamptz;

UPDATE "permits"
SET "permit_version_at" = "submitted_at"
WHERE "submitted_at" IS NOT NULL
  AND "permit_version_at" IS NULL
  AND "status" <> 'closed';

UPDATE "permits" AS p
SET "approved_at" = h."created_at"
FROM (
  SELECT DISTINCT ON ("permit_id") "permit_id", "created_at"
  FROM "approval_history"
  WHERE "action" = 'approved'
  ORDER BY "permit_id", "created_at" DESC
) AS h
WHERE p."id" = h."permit_id"
  AND p."approved_at" IS NULL
  AND p."status" NOT IN ('draft', 'pending_approval', 'rejected', 'deferred', 'closed');
