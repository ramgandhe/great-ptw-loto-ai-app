import type { Pool } from 'pg';

/**
 * NFR-SEC-001a: the running API holds only its own database role, which owns nothing and cannot bypass RLS.
 * It refuses to start if it can see an owner credential or if its role is unsafe.
 */
export async function assertRuntimeDatabaseRole(pool: Pool, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  for (const name of ['MIGRATION_DATABASE_URL', 'PTW_OWNER_PASSWORD']) {
    if (env[name]) throw new Error(`${name} must not be set for the API; migrations run as a separate job (NFR-SEC-001a)`);
  }
  const { rows } = await pool.query<{ unsafe: boolean }>(`
    select r.rolsuper or r.rolbypassrls
           or exists (select 1 from pg_class c where c.relowner = r.oid and c.relnamespace = 'public'::regnamespace) as unsafe
      from pg_roles r where r.rolname = current_user`);
  if (rows[0]?.unsafe !== false) {
    throw new Error('The API database role must not be a superuser, bypass RLS or own tables (NFR-SEC-001a)');
  }
}
