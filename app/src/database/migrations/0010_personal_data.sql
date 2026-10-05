-- FR-PRV-008: every view of personal data, written in the same transaction as the read. Append-only for the API.
-- viewer_person_id has no foreign key: from Phase 4 a viewer can be in another tenant (NFR-SEC-002 b).
CREATE TABLE personal_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organisations (id),
  viewer_tenant_id uuid NOT NULL,
  viewer_person_id uuid,
  subject_person_id uuid NOT NULL,
  fields text[] NOT NULL CHECK (cardinality(fields) > 0),
  purpose text NOT NULL CHECK (purpose IN ('own_record', 'employer_admin')),
  permit_id uuid,
  viewed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX personal_data_access_log_subject ON personal_data_access_log (tenant_id, subject_person_id, viewed_at);
SELECT app_apply_tenant_policy('personal_data_access_log');
REVOKE UPDATE, DELETE ON personal_data_access_log FROM ptw_api;

-- FR-PRV-005: contact details, only for the person and the admins of the person's employer legal entity.
-- The check is here, in the database; PersonalDataService is the only caller and logs each view (FR-PRV-008).
CREATE FUNCTION app_person_contact(p_person_id uuid) RETURNS TABLE (email text, phone text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT p.email, p.phone
    FROM public.people p
   WHERE p.id = p_person_id
     AND p.tenant_id = app_tenant_id()
     AND app_acting_role() = 'user'
     AND app_context_valid()
     AND (p.id = app_person_id()
          OR EXISTS (SELECT 1 FROM public.admin_assignments a
                       JOIN public.people ap ON ap.id = a.person_id AND ap.status = 'active'
                      WHERE a.person_id = app_person_id()
                        AND a.role = 'LEGAL_ORG_ADMIN'
                        AND a.legal_entity_id = p.employer_legal_entity_id))
$$;
REVOKE EXECUTE ON FUNCTION app_person_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_person_contact(uuid) TO ptw_api;
