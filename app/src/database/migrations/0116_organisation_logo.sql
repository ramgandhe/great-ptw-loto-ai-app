ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "logo_storage_key" varchar(512);
--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "logo_content_type" varchar(128);
--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "logo_file_name" varchar(255);
