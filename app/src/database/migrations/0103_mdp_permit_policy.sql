-- Multi-day permit policy flags (Slice A5). Defaults = hard gate + override allowed.
ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "daily_revalidation_required" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "permits"
  ADD COLUMN IF NOT EXISTS "emergency_override_allowed" boolean DEFAULT true NOT NULL;
