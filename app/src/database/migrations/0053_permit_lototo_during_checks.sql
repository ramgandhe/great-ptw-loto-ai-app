CREATE TABLE "permit_lototo_during_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "instance_id" uuid NOT NULL,
  "locks_remain" boolean NOT NULL,
  "comment" text,
  "confirmed_by" uuid NOT NULL,
  "confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "permit_lototo_during_checks"
  ADD CONSTRAINT "permit_lototo_during_checks_instance_id_permit_lototo_instances_id_fk"
  FOREIGN KEY ("instance_id") REFERENCES "permit_lototo_instances"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "permit_lototo_during_checks_instance_id_idx" ON "permit_lototo_during_checks" ("instance_id");
