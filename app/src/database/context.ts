import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export type ActingRole = 'user' | 'platform_admin' | 'job';

/** The request or job context every query runs under (NFR-SEC-008). The database checks it again (app_context_valid). */
export interface DbContext {
  tenantId: string | null;
  personId: string | null;
  legalEntityIds: readonly string[];
  actingRole: ActingRole;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidContext(ctx: DbContext): void {
  const ids = [ctx.tenantId, ctx.personId, ...ctx.legalEntityIds].filter((id): id is string => id !== null);
  if (!ids.every((id) => UUID_PATTERN.test(id))) throw new Error('Database context IDs must be UUIDs');
  if (ctx.actingRole === 'user' && (!ctx.tenantId || !ctx.personId || ctx.legalEntityIds.length === 0)) {
    throw new Error('A user context needs a tenant, a person and a legal entity');
  }
  if (ctx.actingRole === 'platform_admin' && ctx.tenantId) throw new Error('A platform admin context has no tenant');
}

/** An explicitly empty setting. An unset or '' setting means "missing", and a context with a missing setting is no context. */
const NONE = 'none';

/**
 * Runs fn in a transaction whose first statement sets all four settings with set_config(..., true). The
 * settings end with the transaction, so a pooled connection never carries them into the next request.
 * RLS policies read them; an incomplete or inconsistent context matches no rows.
 */
export async function runInContext<T>(db: Database, ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  assertValidContext(ctx);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select
      set_config('app.tenant_id', ${ctx.tenantId ?? NONE}, true),
      set_config('app.person_id', ${ctx.personId ?? NONE}, true),
      set_config('app.legal_entity_ids', ${ctx.legalEntityIds.length ? ctx.legalEntityIds.join(',') : NONE}, true),
      set_config('app.acting_role', ${ctx.actingRole}, true)`);
    return fn(tx);
  });
}

export const jobContext = (tenantId: string): DbContext => ({
  tenantId,
  personId: null,
  legalEntityIds: [],
  actingRole: 'job',
});
