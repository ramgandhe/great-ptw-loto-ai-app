-- Migration 0117: Update Safe work permit template to replace Issuing department with Work location
-- In existing copies of the Safe work permit (SOP-ES-023-F1), replace "Issuing department" field
-- label with "Work location" and update prefill from "department" to "work-location" (or "location").

UPDATE "permit_templates" t
SET "config" = jsonb_set(
  t."config",
  '{sections}',
  (
    SELECT COALESCE(jsonb_agg(
      jsonb_set(
        s.section,
        '{fields}',
        (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN f.field ->> 'label' = 'Issuing department'
                THEN jsonb_set(
                  jsonb_set(f.field, '{label}', '"Work location"'::jsonb),
                  '{prefill}',
                  '"work-location"'::jsonb
                )
              ELSE f.field
            END
            ORDER BY f.position
          ), '[]'::jsonb)
          FROM jsonb_array_elements(s.section -> 'fields') WITH ORDINALITY AS f(field, position)
        )
      )
      ORDER BY s.position
    ), '[]'::jsonb)
    FROM jsonb_array_elements(t."config" -> 'sections') WITH ORDINALITY AS s(section, position)
  )
)
WHERE t."code" = 'SOP-ES-023-F1'
  AND jsonb_typeof(t."config" -> 'sections') = 'array';
