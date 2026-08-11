-- PUS-242 / FR-MDP-009 — multi-day validity transition remediation

ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "timezone" varchar(64) NOT NULL DEFAULT 'UTC';

ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "renewed_from_permit_id" uuid REFERENCES "permits"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "permits_renewed_from_permit_id_idx"
  ON "permits" ("renewed_from_permit_id");

CREATE TABLE IF NOT EXISTS "permit_validity_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "operational_date" date NOT NULL,
  "timezone" varchar(64) NOT NULL,
  "decision" varchar(32) NOT NULL,
  "remaining_hours" integer,
  "planned_end_at" timestamp with time zone,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revalidation_required" boolean DEFAULT false NOT NULL,
  "notified_at" timestamp with time zone,
  "metadata" jsonb,
  CONSTRAINT "permit_validity_checks_decision_check"
    CHECK ("decision" IN ('ok_gt_48h', 'renew_notify_lte_48h', 'expired', 'out_of_range'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_validity_checks_tenant_permit_day_unique"
  ON "permit_validity_checks" ("tenant_id", "permit_id", "operational_date");
CREATE INDEX IF NOT EXISTS "permit_validity_checks_tenant_decision_idx"
  ON "permit_validity_checks" ("tenant_id", "decision");

CREATE TABLE IF NOT EXISTS "permit_renewals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "source_permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "renewal_permit_id" uuid NOT NULL REFERENCES "permits"("id") ON DELETE CASCADE,
  "status" varchar(32) NOT NULL DEFAULT 'draft',
  "requested_by" uuid NOT NULL,
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  "decision_comments" text,
  CONSTRAINT "permit_renewals_status_check"
    CHECK ("status" IN ('draft', 'pending_approval', 'accepted', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_renewals_renewal_permit_unique"
  ON "permit_renewals" ("renewal_permit_id");
CREATE INDEX IF NOT EXISTS "permit_renewals_source_permit_idx"
  ON "permit_renewals" ("source_permit_id");
CREATE INDEX IF NOT EXISTS "permit_renewals_tenant_status_idx"
  ON "permit_renewals" ("tenant_id", "status");
