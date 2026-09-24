ALTER TABLE "workstation_catalogue" ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "locations"("id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "workstation_catalogue_location_id_idx" ON "workstation_catalogue" ("location_id");
