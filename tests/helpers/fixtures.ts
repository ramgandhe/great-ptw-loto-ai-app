import { randomUUID } from 'crypto';
import { Pool } from 'pg';
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
    [tenantId, `Entity ${short()}`, `LE${short().slice(0, 4).toUpperCase()}`],
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
    [tenantId, legalEntityId, `Plant ${short()}`, `P${short().slice(0, 4).toUpperCase()}`],
  );
  return rows[0].id;
}

export interface TenantGraph {
  tenantId: string;
  kind: 'organisation' | 'agency';
  /** An active person with an account. Random until Task 7 creates person records. */
  personId: string;
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
  return { tenantId, kind, personId: randomUUID(), legalEntityId, departmentId, plantId };
}

/** A valid user context for the graph's person. */
export const ctxOf = (g: TenantGraph): DbContext => userCtx(g.tenantId, g.personId, [g.legalEntityId]);
