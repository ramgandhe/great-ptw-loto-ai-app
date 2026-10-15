-- Gas tests can be stored on a work location or an asset. A permit gas row can be added by hand.
ALTER TABLE gas_testing_catalogue ALTER COLUMN workstation_id DROP NOT NULL;

ALTER TABLE gas_testing_catalogue DROP CONSTRAINT IF EXISTS gas_testing_catalogue_target_check;
ALTER TABLE gas_testing_catalogue
  ADD CONSTRAINT gas_testing_catalogue_target_check
  CHECK (workstation_id IS NOT NULL OR work_location_id IS NOT NULL OR asset_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS gas_testing_catalogue_tenant_location_parameter_unique
  ON gas_testing_catalogue (tenant_id, work_location_id, parameter)
  WHERE work_location_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gas_testing_catalogue_tenant_asset_parameter_unique
  ON gas_testing_catalogue (tenant_id, asset_id, parameter)
  WHERE asset_id IS NOT NULL;

ALTER TABLE permit_gas_testing ALTER COLUMN gas_testing_catalogue_id DROP NOT NULL;
