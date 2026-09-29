import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { auditColumns } from './base';
import { organisations } from './organisation';

export const TENANT_INVITE_STATUSES = ['pending', 'accepted', 'cancelled'] as const;
export type TenantInviteStatus = (typeof TENANT_INVITE_STATUSES)[number];

export const tenantInvites = pgTable(
  'tenant_invites',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),
    ownerEmail: varchar('owner_email', { length: 255 }).notNull(),
    token: varchar('token', { length: 128 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    keycloakUserId: varchar('keycloak_user_id', { length: 128 }),
    invitedBy: uuid('invited_by'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('tenant_invites_token_unique').on(table.token),
    index('tenant_invites_tenant_id_idx').on(table.tenantId),
    index('tenant_invites_owner_email_idx').on(table.ownerEmail),
  ],
);

export const tenantUsers = pgTable(
  'tenant_users',
  {
    ...auditColumns,
    tenantId: uuid('tenant_id').notNull(),
    keycloakUserId: varchar('keycloak_user_id', { length: 128 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 128 }),
    lastName: varchar('last_name', { length: 128 }),
    role: varchar('role', { length: 64 }).notNull(),
    departmentId: uuid('department_id'),
    status: varchar('status', { length: 32 }).notNull().default('active'),
  },
  (table) => [
    uniqueIndex('tenant_users_keycloak_user_id_unique').on(table.keycloakUserId),
    uniqueIndex('tenant_users_tenant_email_unique').on(table.tenantId, table.email),
    index('tenant_users_tenant_id_idx').on(table.tenantId),
  ],
);

export const userProfiles = pgTable(
  'user_profiles',
  {
    ...auditColumns,
    userId: varchar('user_id', { length: 128 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    avatarStorageKey: text('avatar_storage_key'),
    avatarContentType: varchar('avatar_content_type', { length: 128 }),
  },
  (table) => [uniqueIndex('user_profiles_user_id_unique').on(table.userId)],
);

export const ACCESS_REQUEST_STATUSES = ['new', 'invited', 'declined'] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

/** Public "Request access" submissions from the marketing site, reviewed by platform admins. */
export const accessRequests = pgTable(
  'access_requests',
  {
    ...auditColumns,
    fullName: varchar('full_name', { length: 255 }).notNull(),
    workEmail: varchar('work_email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    companyName: varchar('company_name', { length: 255 }).notNull(),
    jobTitle: varchar('job_title', { length: 128 }),
    siteCount: varchar('site_count', { length: 16 }),
    message: text('message'),
    status: varchar('status', { length: 32 }).notNull().default('new'),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('access_requests_status_idx').on(table.status),
    index('access_requests_work_email_idx').on(table.workEmail),
  ],
);

/** One-time links for "forgot password". Only the SHA-256 of the token is stored. */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    ...auditColumns,
    keycloakUserId: varchar('keycloak_user_id', { length: 128 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_hash_unique').on(table.tokenHash),
    index('password_reset_tokens_user_idx').on(table.keycloakUserId),
  ],
);
