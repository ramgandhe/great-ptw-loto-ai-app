-- FR-PRV-002: a legal entity's calendar. In-app consent decisions take their date from the employer's local day,
-- the same calendar a signed form carries, so a withdrawal and a form signed the same local day are compared as one day.
ALTER TABLE legal_entities ADD COLUMN time_zone text NOT NULL DEFAULT 'UTC' CHECK (time_zone <> '');
