ALTER TABLE "isolation_certificate_points" ADD COLUMN "restored_by" uuid;
--> statement-breakpoint
ALTER TABLE "isolation_certificate_points" ADD COLUMN "restored_at" timestamp with time zone;
