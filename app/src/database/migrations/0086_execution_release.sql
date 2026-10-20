ALTER TABLE "permits" ADD COLUMN "execution_released_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "permits" ADD COLUMN "execution_released_by" uuid;
--> statement-breakpoint
ALTER TABLE "permits" ADD COLUMN "execution_release_site_ready" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "permits" ADD COLUMN "execution_release_details_correct" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "permits" DISABLE TRIGGER "permits_closed_readonly";
--> statement-breakpoint
UPDATE "permits"
SET
  "execution_released_at" = COALESCE("approved_at", "updated_at", "created_at"),
  "execution_release_site_ready" = true,
  "execution_release_details_correct" = true
WHERE "status" IN (
  'approved',
  'active',
  'suspended',
  'execution_completed',
  'pending_closure',
  'closed',
  'expired',
  'cancelled'
)
AND "execution_released_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "permits" ENABLE TRIGGER "permits_closed_readonly";
