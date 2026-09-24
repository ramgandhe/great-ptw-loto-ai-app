CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "user_id" varchar(128) NOT NULL,
  "display_name" varchar(255),
  "avatar_storage_key" text,
  "avatar_content_type" varchar(128)
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_user_id_unique" ON "user_profiles" ("user_id");
