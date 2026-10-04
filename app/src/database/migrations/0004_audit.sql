-- FR-AUD-001 to 003: who, on whose behalf, when, from which device, what changed. No foreign keys to the
-- records described, so audit outlives them. The API may only insert and read (NFR-SEC-001a).
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organisations (id),
  legal_entity_id uuid,
  actor_person_id uuid,
  on_behalf_of_person_id uuid,
  device_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity ON audit_events (tenant_id, entity_type, entity_id, occurred_at);
SELECT app_apply_tenant_policy('audit_events');
REVOKE UPDATE, DELETE ON audit_events FROM ptw_api;
