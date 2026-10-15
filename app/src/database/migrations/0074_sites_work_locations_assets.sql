-- Refined 14 October 2026. Site, work location and asset replace plant, department,
-- location, workstation and machinery. Old tables stay. Ids are reused so existing
-- permits can point at the new rows. Safe to re-run.

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  tenant_id uuid NOT NULL,
  code varchar(64) NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  address text,
  status varchar(32) NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX IF NOT EXISTS sites_tenant_code_unique ON sites (tenant_id, code);
CREATE INDEX IF NOT EXISTS sites_tenant_id_idx ON sites (tenant_id);

CREATE TABLE IF NOT EXISTS site_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  user_id varchar(128) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS site_members_site_user_unique ON site_members (site_id, user_id);
CREATE INDEX IF NOT EXISTS site_members_tenant_id_idx ON site_members (tenant_id);
CREATE INDEX IF NOT EXISTS site_members_user_id_idx ON site_members (user_id);

CREATE TABLE IF NOT EXISTS location_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  tenant_id uuid NOT NULL,
  name varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX IF NOT EXISTS location_types_tenant_name_unique ON location_types (tenant_id, name);
CREATE INDEX IF NOT EXISTS location_types_tenant_id_idx ON location_types (tenant_id);

CREATE TABLE IF NOT EXISTS work_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  code varchar(64) NOT NULL,
  name varchar(255) NOT NULL,
  location_type_id uuid REFERENCES location_types (id) ON DELETE SET NULL,
  parent_id uuid REFERENCES work_locations (id) ON DELETE RESTRICT,
  description text,
  address text,
  status varchar(32) NOT NULL DEFAULT 'active',
  path_text text,
  legacy_source varchar(32),
  CONSTRAINT work_locations_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS work_locations_site_code_unique ON work_locations (site_id, code);
CREATE INDEX IF NOT EXISTS work_locations_tenant_id_idx ON work_locations (tenant_id);
CREATE INDEX IF NOT EXISTS work_locations_site_id_idx ON work_locations (site_id);
CREATE INDEX IF NOT EXISTS work_locations_parent_id_idx ON work_locations (parent_id);

CREATE TABLE IF NOT EXISTS work_location_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  tenant_id uuid NOT NULL,
  work_location_id uuid NOT NULL REFERENCES work_locations (id) ON DELETE CASCADE,
  user_id varchar(128) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS work_location_approvers_location_user_unique
  ON work_location_approvers (work_location_id, user_id);
CREATE INDEX IF NOT EXISTS work_location_approvers_tenant_id_idx ON work_location_approvers (tenant_id);

CREATE TABLE IF NOT EXISTS asset_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  tenant_id uuid NOT NULL,
  name varchar(64) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX IF NOT EXISTS asset_types_tenant_name_unique ON asset_types (tenant_id, name);
CREATE INDEX IF NOT EXISTS asset_types_tenant_id_idx ON asset_types (tenant_id);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  work_location_id uuid NOT NULL REFERENCES work_locations (id) ON DELETE RESTRICT,
  tag varchar(64) NOT NULL,
  asset_number varchar(64),
  name varchar(255) NOT NULL,
  asset_type_id uuid REFERENCES asset_types (id) ON DELETE SET NULL,
  description text,
  parent_asset_id uuid REFERENCES assets (id) ON DELETE RESTRICT,
  status varchar(32) NOT NULL DEFAULT 'active',
  CONSTRAINT assets_parent_not_self CHECK (parent_asset_id IS NULL OR parent_asset_id <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS assets_site_tag_unique ON assets (site_id, tag);
CREATE UNIQUE INDEX IF NOT EXISTS assets_tenant_asset_number_unique
  ON assets (tenant_id, asset_number) WHERE asset_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS assets_tenant_id_idx ON assets (tenant_id);
CREATE INDEX IF NOT EXISTS assets_site_id_idx ON assets (site_id);
CREATE INDEX IF NOT EXISTS assets_work_location_id_idx ON assets (work_location_id);
CREATE INDEX IF NOT EXISTS assets_parent_asset_id_idx ON assets (parent_asset_id);

INSERT INTO sites (
  id, created_at, updated_at, created_by, updated_by, tenant_id, code, name, description, status
)
SELECT
  p.id, p.created_at, p.updated_at, p.created_by, p.updated_by, p.tenant_id,
  LEFT(COALESCE(NULLIF(btrim(p.code), ''), 'SITE-' || LEFT(p.id::text, 8)), 64),
  p.name, p.description,
  CASE WHEN p.status = 'archived' THEN 'archived' ELSE 'active' END
FROM plants p
WHERE NOT EXISTS (SELECT 1 FROM sites s WHERE s.id = p.id);

-- Tenants that already have places or permits, but no plant, still need a site.
INSERT INTO sites (id, tenant_id, code, name, description, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  src.tenant_id,
  'MAIN',
  COALESCE(
    (SELECT o.name FROM organisations o WHERE o.tenant_id = src.tenant_id ORDER BY o.created_at LIMIT 1),
    'Site'
  ),
  'Created during place migration because this organisation had no plant.',
  'active',
  now(),
  now()
FROM (
  SELECT tenant_id FROM departments
  UNION
  SELECT tenant_id FROM locations
  UNION
  SELECT tenant_id FROM workstation_catalogue
  UNION
  SELECT tenant_id FROM machinery_catalogue
  UNION
  SELECT tenant_id FROM permits
) src
WHERE NOT EXISTS (SELECT 1 FROM sites s WHERE s.tenant_id = src.tenant_id);

INSERT INTO location_types (id, tenant_id, name, status, created_at, updated_at)
SELECT gen_random_uuid(), tenants.tenant_id, names.name, 'active', now(), now()
FROM (SELECT DISTINCT tenant_id FROM organisations) AS tenants
CROSS JOIN (
  VALUES
    ('Plant'), ('Unit'), ('Building'), ('Area'), ('Zone'), ('Room'),
    ('Workshop'), ('Warehouse'), ('Tank Farm'), ('Yard'), ('Structure')
) AS names(name)
WHERE NOT EXISTS (
  SELECT 1 FROM location_types lt
  WHERE lt.tenant_id = tenants.tenant_id AND lt.name = names.name
);

INSERT INTO asset_types (id, tenant_id, name, status, created_at, updated_at)
SELECT gen_random_uuid(), tenants.tenant_id, names.name, 'active', now(), now()
FROM (SELECT DISTINCT tenant_id FROM organisations) AS tenants
CROSS JOIN (
  VALUES
    ('Pump'), ('Motor'), ('Compressor'), ('Valve'), ('Vessel'), ('Tank'),
    ('Column'), ('Heat exchanger'), ('Electrical panel'), ('Conveyor'), ('Crane')
) AS names(name)
WHERE NOT EXISTS (
  SELECT 1 FROM asset_types at
  WHERE at.tenant_id = tenants.tenant_id AND at.name = names.name
);

INSERT INTO work_locations (
  id, created_at, updated_at, created_by, updated_by, tenant_id, site_id,
  code, name, description, status, legacy_source
)
SELECT
  d.id, d.created_at, d.updated_at, d.created_by, d.updated_by, d.tenant_id,
  COALESCE(
    d.plant_id,
    (SELECT s.id FROM sites s WHERE s.tenant_id = d.tenant_id ORDER BY s.created_at LIMIT 1)
  ),
  LEFT(COALESCE(NULLIF(btrim(d.code), ''), 'DEPT-' || LEFT(d.id::text, 8)), 64),
  d.name, d.description,
  CASE WHEN d.status = 'archived' THEN 'archived' ELSE 'active' END,
  'department'
FROM departments d
WHERE COALESCE(
  d.plant_id,
  (SELECT s.id FROM sites s WHERE s.tenant_id = d.tenant_id ORDER BY s.created_at LIMIT 1)
) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM work_locations w WHERE w.id = d.id);

INSERT INTO work_locations (
  id, created_at, updated_at, created_by, updated_by, tenant_id, site_id,
  parent_id, code, name, description, status, legacy_source
)
SELECT
  l.id, l.created_at, l.updated_at, l.created_by, l.updated_by, l.tenant_id,
  COALESCE(
    parent_loc.site_id,
    (SELECT s.id FROM sites s WHERE s.tenant_id = l.tenant_id ORDER BY s.created_at LIMIT 1)
  ),
  parent_loc.id,
  CASE
    WHEN NULLIF(btrim(l.code), '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM work_locations w
      WHERE w.site_id = COALESCE(
        parent_loc.site_id,
        (SELECT s.id FROM sites s WHERE s.tenant_id = l.tenant_id ORDER BY s.created_at LIMIT 1)
      )
        AND w.code = LEFT(btrim(l.code), 64)
    ) THEN LEFT(btrim(l.code), 64)
    ELSE LEFT(COALESCE(NULLIF(btrim(l.code), ''), 'LOC') || '-' || LEFT(l.id::text, 8), 64)
  END,
  l.name, l.description,
  CASE WHEN l.status = 'archived' THEN 'archived' ELSE 'active' END,
  'location'
FROM locations l
LEFT JOIN work_locations parent_loc ON parent_loc.id = l.department_id
WHERE COALESCE(
  parent_loc.site_id,
  (SELECT s.id FROM sites s WHERE s.tenant_id = l.tenant_id ORDER BY s.created_at LIMIT 1)
) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM work_locations w WHERE w.id = l.id);

INSERT INTO work_locations (
  id, created_at, updated_at, created_by, updated_by, tenant_id, site_id,
  parent_id, code, name, description, status, legacy_source
)
SELECT
  ws.id, ws.created_at, ws.updated_at, ws.created_by, ws.updated_by, ws.tenant_id,
  COALESCE(
    parent_loc.site_id,
    (SELECT s.id FROM sites s WHERE s.tenant_id = ws.tenant_id ORDER BY s.created_at LIMIT 1)
  ),
  parent_loc.id,
  CASE
    WHEN NULLIF(btrim(ws.code), '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM work_locations w
      WHERE w.site_id = COALESCE(
        parent_loc.site_id,
        (SELECT s.id FROM sites s WHERE s.tenant_id = ws.tenant_id ORDER BY s.created_at LIMIT 1)
      )
        AND w.code = LEFT(btrim(ws.code), 64)
    ) THEN LEFT(btrim(ws.code), 64)
    ELSE LEFT(COALESCE(NULLIF(btrim(ws.code), ''), 'WS') || '-' || LEFT(ws.id::text, 8), 64)
  END,
  ws.name, ws.description,
  CASE WHEN ws.is_active THEN 'active' ELSE 'archived' END,
  'workstation'
FROM workstation_catalogue ws
LEFT JOIN work_locations parent_loc ON parent_loc.id = ws.location_id
WHERE COALESCE(
  parent_loc.site_id,
  (SELECT s.id FROM sites s WHERE s.tenant_id = ws.tenant_id ORDER BY s.created_at LIMIT 1)
) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM work_locations w WHERE w.id = ws.id);

INSERT INTO work_locations (
  id, created_at, updated_at, tenant_id, site_id, code, name, status, legacy_source
)
SELECT gen_random_uuid(), now(), now(), s.tenant_id, s.id, 'UNASSIGNED', 'Unassigned equipment', 'active', 'migration'
FROM sites s
WHERE EXISTS (
  SELECT 1 FROM machinery_catalogue m
  WHERE m.tenant_id = s.tenant_id
    AND (
      m.workstation_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM work_locations w WHERE w.id = m.workstation_id)
    )
)
  AND NOT EXISTS (
    SELECT 1 FROM work_locations w WHERE w.site_id = s.id AND w.code = 'UNASSIGNED'
  );

WITH RECURSIVE tree AS (
  SELECT id, site_id, name::text AS path, 1 AS depth
  FROM work_locations
  WHERE parent_id IS NULL
  UNION ALL
  SELECT child.id, child.site_id, tree.path || ' › ' || child.name, tree.depth + 1
  FROM work_locations child
  JOIN tree ON child.parent_id = tree.id
  WHERE tree.depth < 30
)
UPDATE work_locations w
SET path_text = s.name || ' › ' || tree.path
FROM tree
JOIN sites s ON s.id = tree.site_id
WHERE w.id = tree.id;

INSERT INTO assets (
  id, created_at, updated_at, created_by, updated_by, tenant_id, site_id,
  work_location_id, tag, name, description, status
)
SELECT
  m.id, m.created_at, m.updated_at, m.created_by, m.updated_by, m.tenant_id,
  loc.site_id, loc.id,
  LEFT(COALESCE(NULLIF(btrim(m.code), ''), 'EQ-' || LEFT(m.id::text, 8)), 64),
  m.name, m.description,
  CASE WHEN m.is_active THEN 'active' ELSE 'archived' END
FROM machinery_catalogue m
JOIN LATERAL (
  SELECT w.id, w.site_id
  FROM work_locations w
  WHERE w.id = m.workstation_id
  UNION ALL
  SELECT w.id, w.site_id
  FROM work_locations w
  WHERE w.tenant_id = m.tenant_id
    AND w.code = 'UNASSIGNED'
    AND NOT EXISTS (SELECT 1 FROM work_locations found WHERE found.id = m.workstation_id)
  LIMIT 1
) loc ON true
WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = m.id);

INSERT INTO work_location_approvers (id, tenant_id, work_location_id, user_id, created_at, updated_at)
SELECT gen_random_uuid(), tu.tenant_id, tu.department_id, tu.keycloak_user_id, now(), now()
FROM tenant_users tu
WHERE tu.department_id IS NOT NULL
  AND (
    tu.role = 'permit-approver'
    OR 'permit-approver' = ANY (tu.roles)
  )
  AND EXISTS (SELECT 1 FROM work_locations w WHERE w.id = tu.department_id)
  AND NOT EXISTS (
    SELECT 1 FROM work_location_approvers a
    WHERE a.work_location_id = tu.department_id AND a.user_id = tu.keycloak_user_id
  );

INSERT INTO site_members (id, tenant_id, site_id, user_id, created_at, updated_at)
SELECT gen_random_uuid(), tu.tenant_id, s.id, tu.keycloak_user_id, now(), now()
FROM tenant_users tu
JOIN sites s ON s.tenant_id = tu.tenant_id
WHERE NOT EXISTS (
  SELECT 1 FROM site_members m WHERE m.site_id = s.id AND m.user_id = tu.keycloak_user_id
);

ALTER TABLE permits DISABLE TRIGGER USER;

ALTER TABLE permits ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites (id) ON DELETE RESTRICT;
ALTER TABLE permits ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES work_locations (id) ON DELETE RESTRICT;
ALTER TABLE permits ADD COLUMN IF NOT EXISTS exact_spot text;
ALTER TABLE permits ADD COLUMN IF NOT EXISTS place_path text;
CREATE INDEX IF NOT EXISTS permits_site_id_idx ON permits (site_id);
CREATE INDEX IF NOT EXISTS permits_work_location_id_idx ON permits (work_location_id);

UPDATE permits p
SET work_location_id = COALESCE(
  (SELECT w.id FROM work_locations w WHERE w.id = p.workstation_id),
  (SELECT w.id FROM work_locations w WHERE w.id = p.location_id),
  (SELECT w.id FROM work_locations w WHERE w.id = p.department_id)
)
WHERE p.work_location_id IS NULL;

UPDATE permits p
SET
  site_id = COALESCE(
    (SELECT s.id FROM sites s WHERE s.id = p.plant_id),
    (SELECT w.site_id FROM work_locations w WHERE w.id = p.work_location_id)
  ),
  place_path = (SELECT w.path_text FROM work_locations w WHERE w.id = p.work_location_id)
WHERE p.site_id IS NULL OR (p.work_location_id IS NOT NULL AND p.place_path IS NULL);

UPDATE permits p
SET site_id = (
  SELECT s.id FROM sites s WHERE s.tenant_id = p.tenant_id ORDER BY s.created_at LIMIT 1
)
WHERE p.site_id IS NULL
  AND (SELECT count(*) FROM sites s WHERE s.tenant_id = p.tenant_id) = 1;

CREATE TABLE IF NOT EXISTS permit_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  permit_id uuid NOT NULL REFERENCES permits (id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS permit_assets_permit_asset_unique ON permit_assets (permit_id, asset_id);
CREATE INDEX IF NOT EXISTS permit_assets_permit_id_idx ON permit_assets (permit_id);
CREATE INDEX IF NOT EXISTS permit_assets_asset_id_idx ON permit_assets (asset_id);

INSERT INTO permit_assets (id, permit_id, asset_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, p.machinery_id, now(), now()
FROM permits p
WHERE p.machinery_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM assets a WHERE a.id = p.machinery_id)
  AND NOT EXISTS (
    SELECT 1 FROM permit_assets pa WHERE pa.permit_id = p.id AND pa.asset_id = p.machinery_id
  );

ALTER TABLE gas_testing_catalogue
  ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES work_locations (id) ON DELETE RESTRICT;
ALTER TABLE gas_testing_catalogue
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS gas_testing_catalogue_work_location_id_idx
  ON gas_testing_catalogue (work_location_id);
CREATE INDEX IF NOT EXISTS gas_testing_catalogue_asset_id_idx ON gas_testing_catalogue (asset_id);

UPDATE gas_testing_catalogue g
SET work_location_id = g.workstation_id
WHERE g.work_location_id IS NULL
  AND EXISTS (SELECT 1 FROM work_locations w WHERE w.id = g.workstation_id);

ALTER TABLE permit_gas_testing ADD COLUMN IF NOT EXISTS source_kind varchar(32);
ALTER TABLE permit_gas_testing ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE permit_gas_testing ADD COLUMN IF NOT EXISTS removed_reason text;
ALTER TABLE permit_gas_testing ADD COLUMN IF NOT EXISTS hand_added boolean NOT NULL DEFAULT false;

UPDATE permit_gas_testing g
SET source_kind = 'work_location', source_id = g.workstation_id
WHERE g.source_kind IS NULL
  AND EXISTS (SELECT 1 FROM work_locations w WHERE w.id = g.workstation_id);

ALTER TABLE permits ENABLE TRIGGER USER;

ALTER TABLE equipment_energy_sources DISABLE TRIGGER USER;
ALTER TABLE isolation_points DISABLE TRIGGER USER;

ALTER TABLE lototo_procedures
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS lototo_procedures_asset_id_idx ON lototo_procedures (asset_id);
UPDATE lototo_procedures p
SET asset_id = p.machinery_id
WHERE p.asset_id IS NULL
  AND EXISTS (SELECT 1 FROM assets a WHERE a.id = p.machinery_id);

ALTER TABLE lototo_plans
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS lototo_plans_asset_id_idx ON lototo_plans (asset_id);
UPDATE lototo_plans p
SET asset_id = p.machinery_id
WHERE p.asset_id IS NULL
  AND EXISTS (SELECT 1 FROM assets a WHERE a.id = p.machinery_id);

ALTER TABLE equipment_energy_sources
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets (id) ON DELETE RESTRICT;
UPDATE equipment_energy_sources e
SET asset_id = e.machinery_id
WHERE e.asset_id IS NULL
  AND EXISTS (SELECT 1 FROM assets a WHERE a.id = e.machinery_id);

ALTER TABLE isolation_points
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets (id) ON DELETE RESTRICT;
UPDATE isolation_points i
SET asset_id = i.machinery_id
WHERE i.asset_id IS NULL
  AND EXISTS (SELECT 1 FROM assets a WHERE a.id = i.machinery_id);

ALTER TABLE equipment_energy_sources ENABLE TRIGGER USER;
ALTER TABLE isolation_points ENABLE TRIGGER USER;

ALTER TABLE incidents DISABLE TRIGGER USER;

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites (id) ON DELETE RESTRICT;
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS work_location_id uuid REFERENCES work_locations (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS incidents_site_id_idx ON incidents (site_id);
CREATE INDEX IF NOT EXISTS incidents_work_location_id_idx ON incidents (work_location_id);

UPDATE incidents i
SET work_location_id = COALESCE(
  (SELECT w.id FROM work_locations w WHERE w.id = i.workstation_id),
  (SELECT w.id FROM work_locations w WHERE w.id = i.location_id)
)
WHERE i.work_location_id IS NULL;

UPDATE incidents i
SET site_id = COALESCE(
  (SELECT s.id FROM sites s WHERE s.id = i.plant_id),
  (SELECT w.site_id FROM work_locations w WHERE w.id = i.work_location_id)
)
WHERE i.site_id IS NULL;

ALTER TABLE incident_equipment
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets (id) ON DELETE RESTRICT;
UPDATE incident_equipment e
SET asset_id = e.machinery_id
WHERE e.asset_id IS NULL
  AND EXISTS (SELECT 1 FROM assets a WHERE a.id = e.machinery_id);

ALTER TABLE incidents ENABLE TRIGGER USER;
