ALTER TABLE "permit_templates"
  ADD COLUMN IF NOT EXISTS "applies_to_all_types" boolean NOT NULL DEFAULT false;

-- Templates already linked to every active permit type of their tenant become "all types",
-- so permit types added later are covered too.
UPDATE "permit_templates" t
SET "applies_to_all_types" = true, "permit_type_ids" = '{}'
WHERE cardinality(t."permit_type_ids") > 1
  AND NOT EXISTS (
    SELECT 1 FROM "permit_types" pt
    WHERE pt."tenant_id" = t."tenant_id"
      AND pt."is_active" = true
      AND NOT (pt."id" = ANY (t."permit_type_ids"))
  );
