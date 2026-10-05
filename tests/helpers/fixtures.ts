import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { DEFAULT_ROLES, type AdminRole, type DefaultRoleKey } from '@ptw/shared';
import type { DbContext } from '../../app/src/database/context';
import { userCtx } from './db';

export const short = (): string => randomUUID().slice(0, 8);

export async function insertOrganisation(owner: Pool, kind: 'organisation' | 'agency' = 'organisation'): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into organisations (kind, slug, name) values ($1, $2, $3) returning id`,
    [kind, `t-${short()}`, `Test ${kind} ${short()}`],
  );
  return rows[0].id;
}

export async function insertLegalEntity(owner: Pool, tenantId: string): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into legal_entities (tenant_id, legal_name, short_code, country) values ($1, $2, $3, 'IN') returning id`,
    [tenantId, `Entity ${short()}`, `LE${short().slice(0, 6).toUpperCase()}`],
  );
  return rows[0].id;
}

export async function insertDepartment(owner: Pool, tenantId: string, legalEntityId: string): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into departments (tenant_id, legal_entity_id, name) values ($1, $2, $3) returning id`,
    [tenantId, legalEntityId, `Department ${short()}`],
  );
  return rows[0].id;
}

export async function insertPlant(owner: Pool, tenantId: string, legalEntityId: string): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into plants (tenant_id, legal_entity_id, name, code, time_zone) values ($1, $2, $3, $4, 'Asia/Kolkata') returning id`,
    [tenantId, legalEntityId, `Plant ${short()}`, `P${short().slice(0, 6).toUpperCase()}`],
  );
  return rows[0].id;
}

export async function insertAccount(owner: Pool): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into accounts (keycloak_subject) values ($1) returning id`,
    [randomUUID()],
  );
  return rows[0].id;
}

/**
 * accountId: undefined creates a new account, null makes a crew-only person.
 * email: defaults to a generated address when the person has an account, otherwise null.
 */
export async function insertPerson(
  owner: Pool,
  tenantId: string,
  legalEntityId: string,
  opts: { accountId?: string | null; email?: string | null } = {},
): Promise<{ personId: string; accountId: string | null }> {
  const accountId = opts.accountId === undefined ? await insertAccount(owner) : opts.accountId;
  const email = opts.email !== undefined ? opts.email : accountId ? `p-${short()}@example.test` : null;
  const { rows } = await owner.query<{ id: string }>(
    `insert into people (tenant_id, employer_legal_entity_id, employment_type, account_id, full_name, email)
     values ($1, $2, 'employee', $3, $4, $5) returning id`,
    [tenantId, legalEntityId, accountId, `Person ${short()}`, email],
  );
  return { personId: rows[0].id, accountId };
}

export async function insertNotice(owner: Pool, tenantId: string, legalEntityId: string, version: number): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into privacy_notices (tenant_id, legal_entity_id, version, notice_text, consent_text) values ($1, $2, $3, $4, $5) returning id`,
    [tenantId, legalEntityId, version, `Notice v${version}`, `Consent wording v${version}`],
  );
  return rows[0].id;
}

export async function insertDefaultRoles(owner: Pool, tenantId: string, legalEntityId: string): Promise<Record<DefaultRoleKey, string>> {
  const ids = {} as Record<DefaultRoleKey, string>;
  for (const role of DEFAULT_ROLES) {
    const { rows } = await owner.query<{ id: string }>(
      `insert into roles (tenant_id, legal_entity_id, key, name, permissions) values ($1, $2, $3, $4, $5) returning id`,
      [tenantId, legalEntityId, role.key, role.name, [...role.permissions]],
    );
    ids[role.key] = rows[0].id;
  }
  return ids;
}

export async function assignRole(
  owner: Pool,
  a: { tenantId: string; personId: string; plantId: string; legalEntityId: string; roleId: string; departmentId?: string },
): Promise<void> {
  await owner.query(
    `insert into plant_assignments (tenant_id, person_id, plant_id, legal_entity_id, role_id, department_id) values ($1, $2, $3, $4, $5, $6)`,
    [a.tenantId, a.personId, a.plantId, a.legalEntityId, a.roleId, a.departmentId ?? null],
  );
}

export async function makeAdmin(
  owner: Pool,
  a: { tenantId: string; personId: string; role: AdminRole; legalEntityId?: string },
): Promise<void> {
  await owner.query(
    `insert into admin_assignments (tenant_id, person_id, role, legal_entity_id) values ($1, $2, $3, $4)`,
    [a.tenantId, a.personId, a.role, a.legalEntityId ?? null],
  );
}

export interface TenantGraph {
  tenantId: string;
  /** An active person with an account. */
  personId: string;
  accountId: string;
  crewOnlyPersonId: string;
  /** The person's employer legal entity. */
  legalEntityId: string;
  departmentId: string;
  plantId: string;
}

/** One row in every tenant table, so the isolation suite can test each table. Each new table adds its row here. */
export async function createTenantGraph(owner: Pool, kind: 'organisation' | 'agency' = 'organisation'): Promise<TenantGraph> {
  const tenantId = await insertOrganisation(owner, kind);
  const legalEntityId = await insertLegalEntity(owner, tenantId);
  const departmentId = await insertDepartment(owner, tenantId, legalEntityId);
  const plantId = await insertPlant(owner, tenantId, legalEntityId);
  const { personId, accountId } = await insertPerson(owner, tenantId, legalEntityId);
  const { personId: crewOnlyPersonId } = await insertPerson(owner, tenantId, legalEntityId, { accountId: null });
  const roleIds = await insertDefaultRoles(owner, tenantId, legalEntityId);
  await assignRole(owner, { tenantId, personId, plantId, legalEntityId, roleId: roleIds.PTW_PERMIT_COORDINATOR });
  await makeAdmin(owner, { tenantId, personId, role: 'LEGAL_ORG_ADMIN', legalEntityId });
  await owner.query(`insert into audit_events (tenant_id, action, entity_type) values ($1, 'fixture.created', 'fixture')`, [tenantId]);
  await owner.query(`insert into tenant_data_keys (tenant_id, version, wrapped_key) values ($1, 1, 'vault:v1:fixture-not-a-key')`, [tenantId]);
  await owner.query(
    `insert into lawful_bases (tenant_id, legal_entity_id, category, purpose, bases, updated_by_person_id) values ($1, $2, 'contact', 'Work contact', '{employment}', $3)`,
    [tenantId, legalEntityId, personId],
  );
  const noticeId = await insertNotice(owner, tenantId, legalEntityId, 1);
  await owner.query(
    `insert into consents (tenant_id, person_id, category, notice_id, decision, method, decided_on, decided_at, recorded_by_person_id)
     values ($1, $2, 'blood_group', $3, 'given', 'in_app', current_date, now(), $2)`,
    [tenantId, personId, noticeId],
  );
  await owner.query(`insert into person_private_data (person_id, tenant_id, blood_group) values ($1, $2, '\\x00')`, [personId, tenantId]);
  await owner.query(
    `insert into personal_data_access_log (tenant_id, viewer_tenant_id, viewer_person_id, subject_person_id, fields, purpose)
     values ($1, $1, $2, $2, '{blood_group}', 'own_record')`,
    [tenantId, personId],
  );
  return { tenantId, personId, accountId: accountId as string, crewOnlyPersonId, legalEntityId, departmentId, plantId };
}

/** A valid user context for the graph's person. */
export const ctxOf = (g: TenantGraph): DbContext => userCtx(g.tenantId, g.personId, [g.legalEntityId]);

export async function engage(
  owner: Pool,
  client: TenantGraph,
  agency: TenantGraph,
  opts: { status?: string; startsInDays?: number; endsInDays?: number; plantIds?: string[] } = {},
): Promise<string> {
  const { rows } = await owner.query<{ id: string }>(
    `insert into engagements (client_tenant_id, client_legal_entity_id, agency_tenant_id, status, starts_on, ends_on)
     values ($1, $2, $3, $4, current_date + $5::int, current_date + $6::int) returning id`,
    [client.tenantId, client.legalEntityId, agency.tenantId, opts.status ?? 'active', opts.startsInDays ?? -1, opts.endsInDays ?? 30],
  );
  for (const plantId of opts.plantIds ?? [client.plantId]) {
    await owner.query(`insert into engagement_plants (engagement_id, client_tenant_id, plant_id) values ($1, $2, $3)`, [
      rows[0].id,
      client.tenantId,
      plantId,
    ]);
  }
  return rows[0].id;
}
