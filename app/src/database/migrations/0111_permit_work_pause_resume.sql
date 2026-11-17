-- Work loop: Pause ⇄ Resume state on execution + pause/resume records.
ALTER TABLE "permit_execution"
  ADD COLUMN IF NOT EXISTS "work_state" varchar(32) DEFAULT 'in_progress' NOT NULL;
--> statement-breakpoint
ALTER TABLE "permit_execution"
  ADD COLUMN IF NOT EXISTS "work_paused_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "permit_execution"
  ADD COLUMN IF NOT EXISTS "work_paused_by" uuid;
--> statement-breakpoint
ALTER TABLE "permit_execution"
  ADD COLUMN IF NOT EXISTS "work_resumed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "permit_execution"
  ADD COLUMN IF NOT EXISTS "work_resumed_by" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_execution_work_state_idx"
  ON "permit_execution" ("work_state");
--> statement-breakpoint
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "overnight_isolation_policy" varchar(32) DEFAULT 'hold' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permit_work_pauses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "summary" text NOT NULL,
  "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "lototo_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "lototo_removals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "overnight_restore_chosen" boolean DEFAULT false NOT NULL,
  "reisolate_required_on_resume" boolean DEFAULT false NOT NULL,
  "paused_by" uuid NOT NULL,
  "paused_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_work_pauses_tenant_permit_idx"
  ON "permit_work_pauses" ("tenant_id", "permit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_work_pauses_execution_idx"
  ON "permit_work_pauses" ("execution_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_work_pauses_permit_paused_at_idx"
  ON "permit_work_pauses" ("permit_id", "paused_at");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "permit_work_pauses"
    ADD CONSTRAINT "permit_work_pauses_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "permit_work_pauses"
    ADD CONSTRAINT "permit_work_pauses_execution_id_permit_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "permit_execution"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permit_work_resumes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "tenant_id" uuid NOT NULL,
  "permit_id" uuid NOT NULL,
  "execution_id" uuid NOT NULL,
  "pause_id" uuid NOT NULL,
  "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "resumed_by" uuid NOT NULL,
  "resumed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permit_work_resumes_pause_id_unique"
  ON "permit_work_resumes" ("pause_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_work_resumes_tenant_permit_idx"
  ON "permit_work_resumes" ("tenant_id", "permit_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permit_work_resumes_pause_id_idx"
  ON "permit_work_resumes" ("pause_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "permit_work_resumes"
    ADD CONSTRAINT "permit_work_resumes_permit_id_permits_id_fk"
    FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "permit_work_resumes"
    ADD CONSTRAINT "permit_work_resumes_execution_id_permit_execution_id_fk"
    FOREIGN KEY ("execution_id") REFERENCES "permit_execution"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "permit_work_resumes"
    ADD CONSTRAINT "permit_work_resumes_pause_id_permit_work_pauses_id_fk"
    FOREIGN KEY ("pause_id") REFERENCES "permit_work_pauses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
UPDATE "permit_execution" SET "work_state" = 'in_progress' WHERE "work_state" IS NULL OR "work_state" = '';
