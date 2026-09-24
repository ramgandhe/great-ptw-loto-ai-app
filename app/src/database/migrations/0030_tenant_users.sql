CREATE TABLE IF NOT EXISTS "tenant_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "keycloak_user_id" varchar(128) NOT NULL,
  "email" varchar(255) NOT NULL,
  "first_name" varchar(128),
  "last_name" varchar(128),
  "role" varchar(64) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'active'
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_users_keycloak_user_id_unique"
  ON "tenant_users" ("keycloak_user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_users_tenant_email_unique"
  ON "tenant_users" ("tenant_id", "email");

CREATE INDEX IF NOT EXISTS "tenant_users_tenant_id_idx"
  ON "tenant_users" ("tenant_id");
