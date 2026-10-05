-- FR-PRV-001: purpose and lawful basis per data category, per legal entity (or agency legal entity).
CREATE TABLE lawful_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('identity', 'sign_in', 'contact', 'emergency_contacts', 'blood_group', 'health_conditions', 'employment_history', 'checkin_location', 'photo')),
  purpose text NOT NULL,
  bases text[] NOT NULL CHECK (cardinality(bases) > 0 AND bases <@ ARRAY['legal_obligation', 'employment', 'vital_interest', 'consent']::text[]),
  change_reason text,
  updated_by_person_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legal_entity_id, category),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id),
  FOREIGN KEY (tenant_id, updated_by_person_id) REFERENCES people (tenant_id, id),
  -- Provisional (owner decision D32): PRD v0.5 defaults, pending counsel's R4 review; may change after counsel.
  -- Emergency contacts (FR-PRV-001) and the sign-in identity (D31) never depend on consent.
  CONSTRAINT required_data_never_needs_consent CHECK (category NOT IN ('emergency_contacts', 'sign_in') OR NOT ('consent' = ANY (bases)))
);
SELECT app_apply_tenant_policy('lawful_bases');

-- Versioned wording. A published version never changes; new wording is a new version.
CREATE TABLE privacy_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  legal_entity_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  notice_text text NOT NULL,
  consent_text text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (legal_entity_id, version),
  FOREIGN KEY (tenant_id, legal_entity_id) REFERENCES legal_entities (tenant_id, id)
);
SELECT app_apply_tenant_policy('privacy_notices');
REVOKE UPDATE, DELETE ON privacy_notices FROM ptw_api;

-- FR-PRV-002: every consent decision is kept, bound to the wording version shown or signed. decided_on is the
-- day the person decided; decided_at is the moment, known only for in-app decisions (a signed form has a date,
-- not a time). recorded_at is when the server received it and is never used to order decisions.
-- The decision in force comes from the latest decided_on: the last timed decision that day, or, if that day
-- has a form, "given" only when every decision that day is "given" (ConsentService.decisionInForce).
CREATE TABLE consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('identity', 'sign_in', 'contact', 'emergency_contacts', 'blood_group', 'health_conditions', 'employment_history', 'checkin_location', 'photo')),
  notice_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('given', 'withheld', 'withdrawn')),
  method text NOT NULL CHECK (method IN ('in_app', 'admin_form')),
  form_file_key text,
  decided_on date NOT NULL,
  decided_at timestamptz,
  recorded_by_person_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id),
  FOREIGN KEY (tenant_id, notice_id) REFERENCES privacy_notices (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by_person_id) REFERENCES people (tenant_id, id),
  CONSTRAINT admin_recorded_consent_has_form CHECK (method <> 'admin_form' OR form_file_key IS NOT NULL),
  CONSTRAINT only_in_app_decisions_are_timed CHECK ((method = 'in_app') = (decided_at IS NOT NULL))
);
CREATE INDEX consents_by_day ON consents (person_id, category, decided_on DESC);
SELECT app_apply_tenant_policy('consents');
REVOKE UPDATE, DELETE ON consents FROM ptw_api;

-- NFR-SEC-003: sensitive person fields, encrypted by the application (Task 14). Consent-based columns are
-- cleared by ConsentService whenever consent stops being in force.
CREATE TABLE person_private_data (
  person_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  blood_group bytea,
  health_conditions bytea,
  emergency_contacts bytea,
  identity_document_number bytea,
  employment_history bytea,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, person_id) REFERENCES people (tenant_id, id)
);
SELECT app_apply_tenant_policy('person_private_data');
