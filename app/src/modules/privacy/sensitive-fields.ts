import type { DataCategory } from '@ptw/shared';
import type { personPrivateData } from '../../database/schema';

/** NFR-SEC-003: the encrypted person fields, each with its FR-PRV-001 data category and column. */
export const SENSITIVE_FIELDS = [
  'blood_group', 'health_conditions', 'emergency_contacts', 'identity_document_number', 'employment_history',
] as const;
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

/**
 * Every stored field of each data category, so a withdrawing decision deletes all of it (FR-PRV-002):
 * encrypted fields in person_private_data and plain columns on people. A category with no stored field in
 * Phase 1a lists none; the phase that first stores such data (photos, check-in locations) adds it here.
 * Record<DataCategory, …> makes the list complete at compile time.
 */
export const CATEGORY_FIELDS: Record<DataCategory, { encrypted: readonly SensitiveField[]; people: readonly ('email' | 'phone')[] }> = {
  identity: { encrypted: ['identity_document_number'], people: [] },
  sign_in: { encrypted: [], people: ['email'] }, // D31: never consent-based (CHECK on lawful_bases), so never deleted by a withdrawal
  contact: { encrypted: [], people: ['phone'] }, // optional contact details only (D31)
  emergency_contacts: { encrypted: ['emergency_contacts'], people: [] }, // never consent-based (CHECK on lawful_bases)
  blood_group: { encrypted: ['blood_group'], people: [] },
  health_conditions: { encrypted: ['health_conditions'], people: [] },
  employment_history: { encrypted: ['employment_history'], people: [] },
  checkin_location: { encrypted: [], people: [] },
  photo: { encrypted: [], people: [] },
};

export const FIELD_CATEGORY = Object.fromEntries(
  (Object.entries(CATEGORY_FIELDS) as [DataCategory, (typeof CATEGORY_FIELDS)[DataCategory]][]).flatMap(([category, fields]) =>
    fields.encrypted.map((field) => [field, category]),
  ),
) as Record<SensitiveField, DataCategory>;

export const FIELD_COLUMN = {
  blood_group: 'bloodGroup',
  health_conditions: 'healthConditions',
  emergency_contacts: 'emergencyContacts',
  identity_document_number: 'identityDocumentNumber',
  employment_history: 'employmentHistory',
} as const satisfies Record<SensitiveField, keyof typeof personPrivateData.$inferSelect>;
