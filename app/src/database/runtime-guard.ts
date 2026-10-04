import type { Pool } from 'pg';

/**
 * NFR-SEC-001a: the running API holds only its own database role, which owns no table (in any schema), cannot
 * bypass RLS, and is not a member (at any depth) of a role that does. It refuses to start if it can see an owner
 * credential or if its role is unsafe.
 */
export async function assertRuntimeDatabaseRole(pool: Pool, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  for (const name of ['MIGRATION_DATABASE_URL', 'PTW_OWNER_PASSWORD']) {
    if (env[name]) throw new Error(`${name} must not be set for the API; migrations run as a separate job (NFR-SEC-001a)`);
  }
  // A role is a member of itself, so this checks the connected role and every role it belongs to.
  const { rows } = await pool.query<{ unsafe: boolean }>(`
    select exists (
      select 1 from pg_roles o
       where pg_has_role(current_user, o.oid, 'MEMBER')
         and (o.rolsuper or o.rolbypassrls or exists (select 1 from pg_class c where c.relowner = o.oid and c.relkind in ('r', 'p')))
    ) as unsafe`);
  if (rows[0]?.unsafe !== false) {
    throw new Error('The API database role must not be a superuser, bypass RLS or own tables, or be a member of a role that does (NFR-SEC-001a)');
  }
}
