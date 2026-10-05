import { date, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Primary key (tenant_id, version) lives in the SQL migration; queries here need only the columns.
export const tenantDataKeys = pgTable('tenant_data_keys', {
  tenantId: uuid('tenant_id').notNull(),
  version: integer('version').notNull(),
  wrappedKey: text('wrapped_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lawfulBases = pgTable('lawful_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  category: text('category').notNull(),
  purpose: text('purpose').notNull(),
  bases: text('bases').array().notNull(),
  changeReason: text('change_reason'),
  updatedByPersonId: uuid('updated_by_person_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const privacyNotices = pgTable('privacy_notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  legalEntityId: uuid('legal_entity_id').notNull(),
  version: integer('version').notNull(),
  noticeText: text('notice_text').notNull(),
  consentText: text('consent_text').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});

export const consents = pgTable('consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  category: text('category').notNull(),
  noticeId: uuid('notice_id').notNull(),
  decision: text('decision', { enum: ['given', 'withheld', 'withdrawn'] }).notNull(),
  method: text('method', { enum: ['in_app', 'admin_form'] }).notNull(),
  formFileKey: text('form_file_key'),
  decidedOn: date('decided_on').notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  recordedByPersonId: uuid('recorded_by_person_id').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});
