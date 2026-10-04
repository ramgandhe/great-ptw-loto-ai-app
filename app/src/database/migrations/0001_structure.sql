-- PRD §3.2: an organisation has legal entities; a legal entity has departments and plants.
-- Child rows reference parents by (tenant_id, id), so a row can never point into another tenant.
CREATE TABLE legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organisations (id),
  legal_name text NOT NULL,
  short_code text NOT NULL CHECK (short_code ~ '^[A-Z0-9]{2,10}$'),
  country char(2) NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, short_code)
);
SELECT app_apply_tenant_policy('legal_entities');

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, legal_entity_id),
  UNIQUE (legal_entity_id, name),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('departments');

CREATE TABLE plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9]{2,10}$'),
  time_zone text NOT NULL,
  status text NOT NULL DEFAULT 'setting_up' CHECK (status IN ('setting_up', 'live', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, legal_entity_id),
  UNIQUE (legal_entity_id, code),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('plants');

-- Context validity now also requires every listed legal entity to belong to the tenant. SECURITY DEFINER
-- (owner, BYPASSRLS) so reading legal_entities here does not recurse through that table's own policy.
CREATE OR REPLACE FUNCTION app_context_valid() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT app_context_complete() AND CASE app_acting_role()
    WHEN 'user' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NOT NULL
      AND cardinality(app_legal_entity_ids()) > 0
      AND NOT EXISTS (SELECT unnest(app_legal_entity_ids()) EXCEPT SELECT id FROM public.legal_entities WHERE tenant_id = app_tenant_id())
    WHEN 'job' THEN app_tenant_id() IS NOT NULL AND app_person_id() IS NULL
      AND NOT EXISTS (SELECT unnest(app_legal_entity_ids()) EXCEPT SELECT id FROM public.legal_entities WHERE tenant_id = app_tenant_id())
    WHEN 'platform_admin' THEN app_tenant_id() IS NULL AND app_person_id() IS NULL AND cardinality(app_legal_entity_ids()) = 0
    ELSE false
  END
$$;
