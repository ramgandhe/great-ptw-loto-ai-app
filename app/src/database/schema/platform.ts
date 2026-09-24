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
