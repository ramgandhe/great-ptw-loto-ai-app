CREATE TABLE "permit_lototo_crew_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "instance_id" uuid NOT NULL,
  "base_point_id" uuid,
  "extra_point_id" uuid,
  "lock_tag_id" varchar(64) NOT NULL,
  "reading" varchar(128),
  "comment" text,
  "completed_by" uuid NOT NULL,
  "completed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "permit_lototo_point_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "instance_id" uuid NOT NULL,
  "base_point_id" uuid,
  "extra_point_id" uuid,
  "result" varchar(32) NOT NULL,
  "try_out_completed" boolean NOT NULL,
  "reading" varchar(128),
  "comment" text,
  "verified_by" uuid NOT NULL,
  "verified_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "permit_lototo_crew_actions"
  ADD CONSTRAINT "permit_lototo_crew_actions_instance_id_permit_lototo_instances_id_fk"
  FOREIGN KEY ("instance_id") REFERENCES "permit_lototo_instances"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "permit_lototo_crew_actions"
  ADD CONSTRAINT "permit_lototo_crew_actions_base_point_id_lototo_procedure_lockout_points_id_fk"
  FOREIGN KEY ("base_point_id") REFERENCES "lototo_procedure_lockout_points"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "permit_lototo_crew_actions"
  ADD CONSTRAINT "permit_lototo_crew_actions_extra_point_id_permit_lototo_extra_points_id_fk"
  FOREIGN KEY ("extra_point_id") REFERENCES "permit_lototo_extra_points"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "permit_lototo_point_verifications"
  ADD CONSTRAINT "permit_lototo_point_verifications_instance_id_permit_lototo_instances_id_fk"
  FOREIGN KEY ("instance_id") REFERENCES "permit_lototo_instances"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "permit_lototo_point_verifications"
  ADD CONSTRAINT "permit_lototo_point_verifications_base_point_id_lototo_procedure_lockout_points_id_fk"
  FOREIGN KEY ("base_point_id") REFERENCES "lototo_procedure_lockout_points"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "permit_lototo_point_verifications"
  ADD CONSTRAINT "permit_lototo_point_verifications_extra_point_id_permit_lototo_extra_points_id_fk"
  FOREIGN KEY ("extra_point_id") REFERENCES "permit_lototo_extra_points"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "permit_lototo_crew_actions_instance_id_idx" ON "permit_lototo_crew_actions" ("instance_id");
CREATE INDEX "permit_lototo_point_verifications_instance_id_idx" ON "permit_lototo_point_verifications" ("instance_id");
