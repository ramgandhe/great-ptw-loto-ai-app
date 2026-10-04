-- PRD §5: permit roles are permission sets per legal entity; people hold them per plant, optionally per department.
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  key text CHECK (key IN ('PTW_PERMIT_COORDINATOR', 'PTW_PERMIT_RECEIVER', 'PTW_PERMIT_APPROVER', 'PTW_SAFETY_OFFICER', 'PTW_PERMIT_EXECUTOR')),
  name text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}' CHECK (permissions <@ ARRAY[
    'raise_permit', 'edit_permit', 'accept_permit', 'add_site_details', 'manage_crew', 'check_crew_in_out',
    'accept_substitute', 'fill_check_sheets', 'safety_check', 'record_gas_test', 'perform_isolation',
    'verify_isolation', 'restore_isolation', 'verify_restoration', 'approve', 'defer', 'send_back', 'reject',
    'issue_permit', 'record_progress', 'accept_days_progress', 'resume', 'revalidate_day', 'request_extension',
    'approve_extension', 'renew_permit', 'cancel_permit', 'report_completion', 'accept_closure',
    'hand_over_permit_duty', 'report_incident', 'decide_near_miss', 'investigate_incident', 'close_incident',
    'review_simops_conflict', 'acknowledge_low_simops_conflict', 'view_reports'
  ]::text[]),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, id, legal_entity_id),
  UNIQUE (legal_entity_id, key),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('roles');

-- The plant's legal entity is stored so the role and department are forced to belong to it.
CREATE TABLE plant_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  plant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  role_id uuid NOT NULL,
  department_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (person_id, plant_id, role_id, department_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id),
  FOREIGN KEY (tenant_id, plant_id, legal_entity_id) REFERENCES plants (tenant_id, id, legal_entity_id),
  FOREIGN KEY (tenant_id, role_id, legal_entity_id) REFERENCES roles (tenant_id, id, legal_entity_id),
  FOREIGN KEY (tenant_id, department_id, legal_entity_id) REFERENCES departments (tenant_id, id, legal_entity_id)
);
CREATE INDEX plant_assignments_person_plant ON plant_assignments (person_id, plant_id);
SELECT app_apply_tenant_policy('plant_assignments');

-- PRD §5.1: admin roles are separate from permit roles and never grant a permit permission (FR-ROL-007).
CREATE TABLE admin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('TENANT_ORG_ADMIN', 'LEGAL_ORG_ADMIN')),
  legal_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'TENANT_ORG_ADMIN') = (legal_entity_id IS NULL)),
  UNIQUE NULLS NOT DISTINCT (person_id, role, legal_entity_id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('admin_assignments');
