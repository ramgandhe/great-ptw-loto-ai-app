-- PUS-243 — SLA escalation + approval delegation (FR-PTW-019–023)

ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "approval_blocked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "approval_blocked_reason" text;

ALTER TABLE "workflow_assignments"
  ADD COLUMN IF NOT EXISTS "escalated_to_role" varchar(64);

CREATE TABLE IF NOT EXISTS "approval_delegations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "delegator_id" uuid NOT NULL,
  "delegate_id" uuid NOT NULL,
  "covers_role" varchar(64) NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "comment" text,
  CONSTRAINT "approval_delegations_date_range_check"
    CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "approval_delegations_not_self_check"
    CHECK ("delegator_id" <> "delegate_id")
);

CREATE INDEX IF NOT EXISTS "approval_delegations_tenant_delegate_idx"
  ON "approval_delegations" ("tenant_id", "delegate_id");
CREATE INDEX IF NOT EXISTS "approval_delegations_tenant_delegator_idx"
  ON "approval_delegations" ("tenant_id", "delegator_id");
CREATE INDEX IF NOT EXISTS "approval_delegations_active_window_idx"
  ON "approval_delegations" ("tenant_id", "delegate_id", "covers_role", "starts_at", "ends_at");
