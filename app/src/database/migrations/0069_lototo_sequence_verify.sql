CREATE TABLE IF NOT EXISTS "permit_lototo_verification_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "instance_id" uuid NOT NULL,
  "phase" varchar(16) NOT NULL,
  "run_number" integer NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'in_progress',
  "result" varchar(32),
  "try_out_completed" boolean NOT NULL DEFAULT false,
  "lock_tag_id" varchar(64),
  "reading" varchar(128),
  "note" text,
  "signed_name" varchar(255),
  "photo_file_name" varchar(255),
  "photo_content_type" varchar(128),
  "photo_storage_key" varchar(512),
  "verified_by" uuid,
  "verified_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "permit_lototo_sequence_ticks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "run_id" uuid NOT NULL,
  "sequence_step_id" uuid NOT NULL,
  "note" text,
  "photo_file_name" varchar(255),
  "photo_content_type" varchar(128),
  "photo_storage_key" varchar(512),
  "ticked_by" uuid NOT NULL,
  "ticked_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permit_lototo_verification_runs_instance_id_permit_lototo_instances_id_fk'
  ) THEN
    ALTER TABLE "permit_lototo_verification_runs"
      ADD CONSTRAINT "permit_lototo_verification_runs_instance_id_permit_lototo_instances_id_fk"
      FOREIGN KEY ("instance_id") REFERENCES "permit_lototo_instances"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permit_lototo_sequence_ticks_run_id_permit_lototo_verification_runs_id_fk'
  ) THEN
    ALTER TABLE "permit_lototo_sequence_ticks"
      ADD CONSTRAINT "permit_lototo_sequence_ticks_run_id_permit_lototo_verification_runs_id_fk"
      FOREIGN KEY ("run_id") REFERENCES "permit_lototo_verification_runs"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permit_lototo_sequence_ticks_sequence_step_id_lototo_procedure_sequence_steps_id_fk'
  ) THEN
    ALTER TABLE "permit_lototo_sequence_ticks"
      ADD CONSTRAINT "permit_lototo_sequence_ticks_sequence_step_id_lototo_procedure_sequence_steps_id_fk"
      FOREIGN KEY ("sequence_step_id") REFERENCES "lototo_procedure_sequence_steps"("id") ON DELETE restrict;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "permit_lototo_verification_runs_instance_phase_run_unique"
  ON "permit_lototo_verification_runs" ("instance_id", "phase", "run_number");
CREATE INDEX IF NOT EXISTS "permit_lototo_verification_runs_instance_id_idx"
  ON "permit_lototo_verification_runs" ("instance_id");
CREATE UNIQUE INDEX IF NOT EXISTS "permit_lototo_sequence_ticks_run_step_unique"
  ON "permit_lototo_sequence_ticks" ("run_id", "sequence_step_id");
CREATE INDEX IF NOT EXISTS "permit_lototo_sequence_ticks_run_id_idx"
  ON "permit_lototo_sequence_ticks" ("run_id");
