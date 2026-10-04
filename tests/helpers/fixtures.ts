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

export interface TenantGraph {
  tenantId: string;
  kind: 'organisation' | 'agency';
  /** An active person with an account. Random until Task 7 creates person records. */
  personId: string;
  /** The person's employer legal entity. Random until Task 6 creates legal entities. */
  legalEntityId: string;
}

/** One row in every tenant table, so the isolation suite can test each table. Each new table adds its row here. */
export async function createTenantGraph(owner: Pool, kind: 'organisation' | 'agency' = 'organisation'): Promise<TenantGraph> {
  const tenantId = await insertOrganisation(owner, kind);
  return { tenantId, kind, personId: randomUUID(), legalEntityId: randomUUID() };
}

/** A valid user context for the graph's person. */
export const ctxOf = (g: TenantGraph): DbContext => userCtx(g.tenantId, g.personId, [g.legalEntityId]);
