ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "owner_email" varchar(255);

CREATE TABLE IF NOT EXISTS "tenant_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "organisation_id" uuid NOT NULL,
  "owner_email" varchar(255) NOT NULL,
  "token" varchar(128) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "keycloak_user_id" varchar(128),
  "invited_by" uuid,
  "accepted_at" timestamptz,
  CONSTRAINT "tenant_invites_organisation_id_organisations_id_fk"
    FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invites_token_unique"
  ON "tenant_invites" ("token");

CREATE INDEX IF NOT EXISTS "tenant_invites_tenant_id_idx"
  ON "tenant_invites" ("tenant_id");

CREATE INDEX IF NOT EXISTS "tenant_invites_owner_email_idx"
  ON "tenant_invites" ("owner_email");

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invites_owner_email_active_unique"
  ON "tenant_invites" (lower("owner_email"))
  WHERE "status" IN ('pending', 'accepted');
