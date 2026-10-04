-- NFR-SEC-003: one data key per tenant and version, stored only wrapped by the master key.
-- Append-only for the API: a wrapped key is never overwritten, because losing it loses the data.
CREATE TABLE tenant_data_keys (
  tenant_id uuid NOT NULL REFERENCES organisations (id),
  version integer NOT NULL CHECK (version > 0),
  wrapped_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, version)
);
SELECT app_apply_tenant_policy('tenant_data_keys');
REVOKE UPDATE, DELETE ON tenant_data_keys FROM ptw_api;
