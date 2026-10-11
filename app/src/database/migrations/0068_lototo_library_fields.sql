ALTER TABLE "lototo_procedure_lockout_points"
  ADD COLUMN IF NOT EXISTS "energy_other_text" varchar(255);

ALTER TABLE "permit_lototo_extra_points"
  ADD COLUMN IF NOT EXISTS "energy_other_text" varchar(255);

ALTER TABLE "lototo_procedure_sequence_steps"
  ADD COLUMN IF NOT EXISTS "action" text,
  ADD COLUMN IF NOT EXISTS "info_text" text,
  ADD COLUMN IF NOT EXISTS "verification" text,
  ADD COLUMN IF NOT EXISTS "note" text;

ALTER TABLE "lototo_procedure_photos"
  ADD COLUMN IF NOT EXISTS "sequence_step_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lototo_procedure_photos_sequence_step_id_lototo_procedure_sequence_steps_id_fk'
  ) THEN
    ALTER TABLE "lototo_procedure_photos"
      ADD CONSTRAINT "lototo_procedure_photos_sequence_step_id_lototo_procedure_sequence_steps_id_fk"
      FOREIGN KEY ("sequence_step_id") REFERENCES "lototo_procedure_sequence_steps"("id") ON DELETE SET NULL;
  END IF;
END $$;
