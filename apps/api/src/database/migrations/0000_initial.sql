CREATE TABLE IF NOT EXISTS "platform_metadata" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "key" varchar(128) NOT NULL,
  "value" text NOT NULL,
  CONSTRAINT "platform_metadata_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "action" varchar(64) NOT NULL,
  "entity_type" varchar(64) NOT NULL,
  "entity_id" uuid,
  "user_id" uuid,
  "tenant_id" uuid,
  "metadata" jsonb
);
