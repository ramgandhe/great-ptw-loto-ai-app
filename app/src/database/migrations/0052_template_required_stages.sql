-- Companies' copies of the Safe work permit (SOP-ES-023-F1) and the hot work check sheet
-- (SOP-ES-023-F4) get the reference templates' required-at stages: the HOD and authoriser sign at
-- approval; completion acceptance and the fire watch three hours after completion are at closure.
-- Without this, those later-stage signatures blocked submission.
-- Only required fields with no stage yet are touched, so an org admin's own choice is kept.
-- Permits keep the form snapshot they were filled in with; only the templates change.
UPDATE "permit_templates" t
SET "config" = jsonb_set(
  t."config",
  '{sections}',
  (
    -- COALESCE: an empty sections array must stay [], never NULL (jsonb_set with NULL drops the config).
    SELECT COALESCE(jsonb_agg(
      jsonb_set(
        s.section,
        '{fields}',
        (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN (f.field ->> 'required')::boolean IS TRUE AND NOT (f.field ? 'requiredAt')
                AND f.field ->> 'label' IN ('HOD of job issuer', 'Job authorised by')
                THEN f.field || '{"requiredAt": "approval"}'::jsonb
              WHEN (f.field ->> 'required')::boolean IS TRUE AND NOT (f.field ? 'requiredAt')
                AND f.field ->> 'label' IN ('Job completion accepted by', 'Fire watch: three hours after completion')
                THEN f.field || '{"requiredAt": "closure"}'::jsonb
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
WHERE t."code" IN ('SOP-ES-023-F1', 'SOP-ES-023-F4')
  AND jsonb_typeof(t."config" -> 'sections') = 'array';
