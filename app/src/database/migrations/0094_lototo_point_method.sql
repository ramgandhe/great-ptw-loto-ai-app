ALTER TABLE "lototo_procedure_lockout_points" ADD COLUMN IF NOT EXISTS "method" varchar(64);
ALTER TABLE "lototo_procedure_lockout_points" ADD COLUMN IF NOT EXISTS "normal_position" varchar(128);
ALTER TABLE "lototo_procedure_lockout_points" ADD COLUMN IF NOT EXISTS "isolated_position" varchar(128);
ALTER TABLE "lototo_procedure_lockout_points" ADD COLUMN IF NOT EXISTS "restore_action" text;
ALTER TABLE "lototo_procedure_lockout_points" ADD COLUMN IF NOT EXISTS "proof" varchar(64);
ALTER TABLE "lototo_procedure_lockout_points" ADD COLUMN IF NOT EXISTS "drawing_reference" varchar(255);
ALTER TABLE "lototo_procedure_lockout_points" ADD COLUMN IF NOT EXISTS "remove_order" integer;

ALTER TABLE "lototo_procedures" ADD COLUMN IF NOT EXISTS "review_due_on" date;

UPDATE "lototo_procedure_lockout_points"
SET "energy_type" = 'gravity'
WHERE lower("energy_type") = 'gravitational';

DELETE FROM "energy_sources" AS duplicate
USING "energy_sources" AS kept
WHERE duplicate.code = 'gravitational'
  AND kept.tenant_id = duplicate.tenant_id
  AND kept.code = 'gravity';

UPDATE "energy_sources"
SET "code" = 'gravity', "name" = 'Gravity'
WHERE "code" = 'gravitational';
