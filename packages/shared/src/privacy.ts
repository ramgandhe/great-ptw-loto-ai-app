/** FR-PRV-001: personal-data categories, each with a purpose and lawful basis per legal entity or agency. */
export const DATA_CATEGORIES = [
  'identity', 'sign_in', 'contact', 'emergency_contacts', 'blood_group', 'health_conditions', 'employment_history',
  'checkin_location', 'photo',
] as const;
export type DataCategory = (typeof DATA_CATEGORIES)[number];

export const LAWFUL_BASES = ['legal_obligation', 'employment', 'vital_interest', 'consent'] as const;
export type LawfulBasis = (typeof LAWFUL_BASES)[number];

// Provisional (owner decision D32): PRD v0.5 defaults, pending counsel's R4 review; may change after counsel.
/** FR-PRV-001 platform defaults. An admin changes one only after recording the legal reason. */
export const DEFAULT_LAWFUL_BASES: Partial<Record<DataCategory, readonly LawfulBasis[]>> = {
  blood_group: ['consent'],
  health_conditions: ['consent'],
  emergency_contacts: ['employment', 'vital_interest'],
  // D31: sign-in, tenant access and the account identity used for segregation of duties need it.
  sign_in: ['employment'],
};
