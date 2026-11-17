ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "max_multi_day_validity_days" integer DEFAULT 7 NOT NULL;
--> statement-breakpoint
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "operational_day_cutoff" varchar(5) DEFAULT '16:30' NOT NULL;
--> statement-breakpoint
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "overtime_approver_role" varchar(32) DEFAULT 'permit-approver' NOT NULL;
