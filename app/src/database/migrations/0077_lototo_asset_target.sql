-- LOTOTO procedures, energy sources and isolation points can hang off an asset.
ALTER TABLE lototo_procedures ALTER COLUMN machinery_id DROP NOT NULL;
ALTER TABLE equipment_energy_sources ALTER COLUMN machinery_id DROP NOT NULL;
ALTER TABLE isolation_points ALTER COLUMN machinery_id DROP NOT NULL;

ALTER TABLE lototo_procedures DROP CONSTRAINT IF EXISTS lototo_procedures_target_check;
ALTER TABLE lototo_procedures
  ADD CONSTRAINT lototo_procedures_target_check
  CHECK (machinery_id IS NOT NULL OR asset_id IS NOT NULL);

ALTER TABLE equipment_energy_sources DROP CONSTRAINT IF EXISTS equipment_energy_sources_target_check;
ALTER TABLE equipment_energy_sources
  ADD CONSTRAINT equipment_energy_sources_target_check
  CHECK (machinery_id IS NOT NULL OR asset_id IS NOT NULL);

ALTER TABLE isolation_points DROP CONSTRAINT IF EXISTS isolation_points_target_check;
ALTER TABLE isolation_points
  ADD CONSTRAINT isolation_points_target_check
  CHECK (machinery_id IS NOT NULL OR asset_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS equipment_energy_sources_plan_asset_type_unique
  ON equipment_energy_sources (plan_id, asset_id, energy_source_type)
  WHERE asset_id IS NOT NULL;

ALTER TABLE incident_equipment ALTER COLUMN machinery_id DROP NOT NULL;
ALTER TABLE incident_equipment DROP CONSTRAINT IF EXISTS incident_equipment_target_check;
ALTER TABLE incident_equipment
  ADD CONSTRAINT incident_equipment_target_check
  CHECK (machinery_id IS NOT NULL OR asset_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS incident_equipment_incident_asset_unique
  ON incident_equipment (incident_id, asset_id)
  WHERE asset_id IS NOT NULL;
