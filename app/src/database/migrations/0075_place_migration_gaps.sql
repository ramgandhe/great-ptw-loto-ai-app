-- Catch-up for 0074. Tenants that had workstations or permits but no plant
-- received no site, so those rows were skipped. Safe to re-run.

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
FROM (SELECT DISTINCT tenant_id FROM sites) AS tenants
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
FROM (SELECT DISTINCT tenant_id FROM sites) AS tenants
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
WHERE w.id = tree.id
  AND w.path_text IS DISTINCT FROM (s.name || ' › ' || tree.path);

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
  AND (tu.role = 'permit-approver' OR 'permit-approver' = ANY (tu.roles))
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

UPDATE permits p
SET work_location_id = COALESCE(
  (SELECT w.id FROM work_locations w WHERE w.id = p.workstation_id),
  (SELECT w.id FROM work_locations w WHERE w.id = p.location_id),
  (SELECT w.id FROM work_locations w WHERE w.id = p.department_id)
)
WHERE p.work_location_id IS NULL
  AND COALESCE(p.workstation_id, p.location_id, p.department_id) IS NOT NULL;

UPDATE permits p
SET
  site_id = COALESCE(
    (SELECT s.id FROM sites s WHERE s.id = p.plant_id),
    (SELECT w.site_id FROM work_locations w WHERE w.id = p.work_location_id),
    p.site_id
  ),
  place_path = COALESCE(
    (SELECT w.path_text FROM work_locations w WHERE w.id = p.work_location_id),
    p.place_path
  )
WHERE p.site_id IS NULL
   OR (p.work_location_id IS NOT NULL AND p.place_path IS NULL);

UPDATE permits p
SET site_id = (
  SELECT s.id FROM sites s WHERE s.tenant_id = p.tenant_id ORDER BY s.created_at LIMIT 1
)
WHERE p.site_id IS NULL
  AND (SELECT count(*) FROM sites s WHERE s.tenant_id = p.tenant_id) = 1;

INSERT INTO permit_assets (id, permit_id, asset_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, p.machinery_id, now(), now()
FROM permits p
WHERE p.machinery_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM assets a WHERE a.id = p.machinery_id)
  AND NOT EXISTS (
    SELECT 1 FROM permit_assets pa WHERE pa.permit_id = p.id AND pa.asset_id = p.machinery_id
  );

UPDATE gas_testing_catalogue g
SET work_location_id = g.workstation_id
WHERE g.work_location_id IS NULL
  AND EXISTS (SELECT 1 FROM work_locations w WHERE w.id = g.workstation_id);

UPDATE permit_gas_testing g
SET source_kind = 'work_location', source_id = g.workstation_id
WHERE g.source_kind IS NULL
  AND EXISTS (SELECT 1 FROM work_locations w WHERE w.id = g.workstation_id);

ALTER TABLE permits ENABLE TRIGGER USER;

ALTER TABLE equipment_energy_sources DISABLE TRIGGER USER;
ALTER TABLE isolation_points DISABLE TRIGGER USER;

UPDATE lototo_procedures p
SET asset_id = p.machinery_id
WHERE p.asset_id IS NULL AND EXISTS (SELECT 1 FROM assets a WHERE a.id = p.machinery_id);

UPDATE lototo_plans p
SET asset_id = p.machinery_id
WHERE p.asset_id IS NULL AND EXISTS (SELECT 1 FROM assets a WHERE a.id = p.machinery_id);

UPDATE equipment_energy_sources e
SET asset_id = e.machinery_id
WHERE e.asset_id IS NULL AND EXISTS (SELECT 1 FROM assets a WHERE a.id = e.machinery_id);

UPDATE isolation_points i
SET asset_id = i.machinery_id
WHERE i.asset_id IS NULL AND EXISTS (SELECT 1 FROM assets a WHERE a.id = i.machinery_id);

ALTER TABLE equipment_energy_sources ENABLE TRIGGER USER;
ALTER TABLE isolation_points ENABLE TRIGGER USER;

ALTER TABLE incidents DISABLE TRIGGER USER;

UPDATE incidents i
SET work_location_id = COALESCE(
  (SELECT w.id FROM work_locations w WHERE w.id = i.workstation_id),
  (SELECT w.id FROM work_locations w WHERE w.id = i.location_id)
)
WHERE i.work_location_id IS NULL;

UPDATE incidents i
SET site_id = COALESCE(
  (SELECT s.id FROM sites s WHERE s.id = i.plant_id),
  (SELECT w.site_id FROM work_locations w WHERE w.id = i.work_location_id),
  (
    SELECT s.id FROM sites s
    WHERE s.tenant_id = i.tenant_id
      AND (SELECT count(*) FROM sites s2 WHERE s2.tenant_id = i.tenant_id) = 1
    LIMIT 1
  )
)
WHERE i.site_id IS NULL;

UPDATE incident_equipment e
SET asset_id = e.machinery_id
WHERE e.asset_id IS NULL AND EXISTS (SELECT 1 FROM assets a WHERE a.id = e.machinery_id);

ALTER TABLE incidents ENABLE TRIGGER USER;
