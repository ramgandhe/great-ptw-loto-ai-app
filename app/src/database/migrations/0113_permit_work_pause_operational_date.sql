-- Site calendar date of a work pause. Cut-off does not roll the date.
ALTER TABLE "permit_work_pauses" ADD COLUMN IF NOT EXISTS "operational_date" date;
--> statement-breakpoint
UPDATE "permit_work_pauses"
SET "operational_date" = ("paused_at" AT TIME ZONE 'UTC')::date
WHERE "operational_date" IS NULL;
--> statement-breakpoint
ALTER TABLE "permit_work_pauses" ALTER COLUMN "operational_date" SET NOT NULL;
