ALTER TABLE "gas_testing_catalogue"
  ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
