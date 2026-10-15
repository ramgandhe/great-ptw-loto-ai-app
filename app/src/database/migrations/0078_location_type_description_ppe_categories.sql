-- Location types can carry a description. PPE categories are an admin-managed list.
-- A LOTOTO procedure can remain after its asset is deleted, so the target check no longer
-- requires a machinery or asset id.

ALTER TABLE location_types ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS ppe_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  tenant_id uuid NOT NULL,
  name varchar(128) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX IF NOT EXISTS ppe_categories_tenant_name_unique ON ppe_categories (tenant_id, name);
CREATE INDEX IF NOT EXISTS ppe_categories_tenant_id_idx ON ppe_categories (tenant_id);

ALTER TABLE lototo_procedures DROP CONSTRAINT IF EXISTS lototo_procedures_target_check;
ALTER TABLE equipment_energy_sources DROP CONSTRAINT IF EXISTS equipment_energy_sources_target_check;
ALTER TABLE isolation_points DROP CONSTRAINT IF EXISTS isolation_points_target_check;
