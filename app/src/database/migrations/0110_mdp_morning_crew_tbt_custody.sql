-- Wave 2–3: per-day toolbox talk, daily crew roster, hard-custody event types.
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "daily_toolbox_talk_required" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "daily_crew_roster_required" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "daily_ppe_hazard_reconfirm" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "hard_mdp_custody_enforced" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permit_toolbox_talks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "operational_date" date NOT NULL,
  "topic" text NOT NULL,
  "conducted_by" uuid NOT NULL,
  "attendee_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "conducted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permit_toolbox_talks_tenant_permit_day_unique"
  ON "permit_toolbox_talks" ("tenant_id", "permit_id", "operational_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_toolbox_talks_tenant_permit_idx"
  ON "permit_toolbox_talks" ("tenant_id", "permit_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "permit_toolbox_talks"
    ADD CONSTRAINT "permit_toolbox_talks_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permit_daily_crew" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "operational_date" date NOT NULL,
  "workforce_user_id" uuid NOT NULL,
  "role" varchar(32) DEFAULT 'primary' NOT NULL,
  "substitute_for_user_id" uuid,
  "notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permit_daily_crew_tenant_permit_day_user_unique"
  ON "permit_daily_crew" ("tenant_id", "permit_id", "operational_date", "workforce_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_daily_crew_tenant_permit_day_idx"
  ON "permit_daily_crew" ("tenant_id", "permit_id", "operational_date");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "permit_daily_crew"
    ADD CONSTRAINT "permit_daily_crew_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
