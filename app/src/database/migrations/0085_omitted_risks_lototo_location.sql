ALTER TABLE "permit_hazards" ADD COLUMN IF NOT EXISTS "omitted_risks" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "lototo_procedures" ADD COLUMN IF NOT EXISTS "work_location_id" uuid;
DO $$ BEGIN
  ALTER TABLE "lototo_procedures"
    ADD CONSTRAINT "lototo_procedures_work_location_id_work_locations_id_fk"
    FOREIGN KEY ("work_location_id") REFERENCES "work_locations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "lototo_procedures_work_location_id_idx" ON "lototo_procedures" ("work_location_id");
