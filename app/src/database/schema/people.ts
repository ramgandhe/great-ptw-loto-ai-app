import { customType, date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  keycloakSubject: text('keycloak_subject').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// email (the sign-in identity, D31) and phone (optional contact) are not selectable by the API role (FR-PRV-005):
// always select explicit columns from people.
export const people = pgTable('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  employerLegalEntityId: uuid('employer_legal_entity_id').notNull(),
  employmentType: text('employment_type', { enum: ['employee', 'contractor'] }).notNull(),
  accountId: uuid('account_id'),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  designation: text('designation'),
  status: text('status', { enum: ['active', 'left'] }).notNull().default('active'),
  leftOn: date('left_on'),
  ...timestamps,
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const personPrivateData = pgTable('person_private_data', {
  personId: uuid('person_id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  bloodGroup: bytea('blood_group'),
  healthConditions: bytea('health_conditions'),
  emergencyContacts: bytea('emergency_contacts'),
  identityDocumentNumber: bytea('identity_document_number'),
  employmentHistory: bytea('employment_history'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
