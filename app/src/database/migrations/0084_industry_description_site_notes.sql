ALTER TABLE "industries" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "permits" ADD COLUMN IF NOT EXISTS "site_notes" text;
