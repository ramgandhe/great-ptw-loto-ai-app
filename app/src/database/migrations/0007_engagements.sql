-- FR-AGY-004 skeleton: the link between a client organisation and an agency. Phase 4 adds work types,
-- nominated receivers, invitations and wind-down. Both parties read it; only the client writes it.
CREATE TABLE engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_tenant_id uuid NOT NULL REFERENCES organisations (id),
  client_legal_entity_id uuid NOT NULL,
  agency_tenant_id uuid NOT NULL REFERENCES organisations (id),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'declined', 'ended', 'ended_now')),
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_tenant_id, id),
  FOREIGN KEY (client_tenant_id, client_legal_entity_id) REFERENCES legal_entities (tenant_id, id),
  CHECK (client_tenant_id <> agency_tenant_id)
);
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements FORCE ROW LEVEL SECURITY;
CREATE POLICY engagement_parties_read ON engagements FOR SELECT
  USING ((SELECT app_context_valid()) AND app_tenant_id() IN (client_tenant_id, agency_tenant_id));
CREATE POLICY engagement_client_insert ON engagements FOR INSERT
  WITH CHECK ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());
CREATE POLICY engagement_client_update ON engagements FOR UPDATE
  USING ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id())
  WITH CHECK ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());
CREATE POLICY engagement_client_delete ON engagements FOR DELETE
  USING ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());

CREATE TABLE engagement_plants (
  engagement_id uuid NOT NULL,
  client_tenant_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  PRIMARY KEY (engagement_id, plant_id),
  FOREIGN KEY (client_tenant_id, engagement_id) REFERENCES engagements (client_tenant_id, id),
  FOREIGN KEY (client_tenant_id, plant_id) REFERENCES plants (tenant_id, id)
);
ALTER TABLE engagement_plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_plants FORCE ROW LEVEL SECURITY;
CREATE POLICY engagement_plants_parties_read ON engagement_plants FOR SELECT
  USING ((SELECT app_context_valid())
         AND (client_tenant_id = app_tenant_id()
              OR EXISTS (SELECT 1 FROM engagements e WHERE e.id = engagement_id AND e.agency_tenant_id = app_tenant_id())));
CREATE POLICY engagement_plants_client_insert ON engagement_plants FOR INSERT
  WITH CHECK ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());
CREATE POLICY engagement_plants_client_update ON engagement_plants FOR UPDATE
  USING ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id())
  WITH CHECK ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());
CREATE POLICY engagement_plants_client_delete ON engagement_plants FOR DELETE
  USING ((SELECT app_context_valid()) AND client_tenant_id = app_tenant_id());

-- NFR-SEC-002 (a) building block: the request tenant is an agency with an active engagement covering this
-- client plant today. Used by the agency read policies on permits (Phases 3 and 4). Phase 4 adds wind-down;
-- Phase 3 replaces current_date with the test clock (NFR-TST-001).
CREATE FUNCTION app_agency_covers_plant(p_plant_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
      FROM engagements e
      JOIN engagement_plants ep ON ep.engagement_id = e.id
     WHERE ep.plant_id = p_plant_id
       AND e.agency_tenant_id = app_tenant_id()
       AND e.status = 'active'
       AND current_date BETWEEN e.starts_on AND e.ends_on)
$$;
