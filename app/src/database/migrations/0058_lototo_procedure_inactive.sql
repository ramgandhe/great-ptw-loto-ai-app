ALTER TABLE "lototo_procedures" DROP CONSTRAINT IF EXISTS "lototo_procedures_status_check";
ALTER TABLE "lototo_procedures" ADD CONSTRAINT "lototo_procedures_status_check" CHECK ("status" IN ('draft', 'published', 'inactive'));
