import { Pool, PoolClient } from 'pg';
import { apiDatabaseUrl, connectOwner } from './helpers/db';

/** Tables the API may only INSERT into and SELECT from (NFR-SEC-001a, FR-AUD-003). Later tasks add to it. */
const APPEND_ONLY: string[] = ['audit_events', 'tenant_data_keys', 'privacy_notices', 'consents', 'personal_data_access_log'];

/** Full-record-only columns the API role must not select directly (FR-PRV-005). Later tasks add to it. */
const FULL_RECORD_COLUMNS: [string, string][] = [['people', 'email'], ['people', 'phone']];

/**
 * SECURITY DEFINER functions the API role may execute, by full signature (regprocedure, public on the search_path),
 * so an overload is not let in by its name: each runs as the owner with a pinned search_path. A new one is added here on purpose.
 */
const ALLOWED_DEFINERS: string[] = ['app_context_valid()', 'app_tenant_ids_for_jobs()', 'app_person_contact(uuid)'];

// NFR-SEC-001a: "A CI schema test, run as the API role, fails if any application table lacks FORCE RLS
// or a policy, or if the API role is a superuser, has BYPASSRLS or owns a table."
describe('Schema security (NFR-SEC-001a)', () => {
  const pool = new Pool({ connectionString: apiDatabaseUrl });
  const owner = connectOwner(); // only the self-test below, in a transaction it rolls back

  afterAll(async () => {
    await pool.end();
    await owner.end();
  });

  it('runs as the API role, which is neither a superuser nor able to bypass RLS', async () => {
    const { rows } = await pool.query(
      `select current_user as name, rolsuper as super, rolbypassrls as bypass from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ name: 'ptw_api', super: false, bypass: false });
  });

  it('finds every application table owned by someone else, with ENABLE and FORCE RLS and a policy', async () => {
    const { rows } = await pool.query<{ table: string; owner: string; mine: boolean; rls: boolean; forced: boolean; policies: number }>(`
      select c.relname as table, pg_get_userbyid(c.relowner) as owner, pg_get_userbyid(c.relowner) = current_user as mine,
             c.relrowsecurity as rls, c.relforcerowsecurity as forced,
             (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
       order by 1`);
    expect(rows.length).toBeGreaterThan(0);
    const problems = rows.filter((r) => r.mine || !r.rls || !r.forced || r.policies === 0);
    expect(problems).toEqual([]);
  });

  it('is not a member, at any depth, of a role that is a superuser, bypasses RLS or owns a table', async () => {
    const { rows } = await pool.query<{ name: string }>(`
      select o.rolname as name from pg_roles o
       where o.rolname <> current_user and pg_has_role(current_user, o.oid, 'MEMBER')
         and (o.rolsuper or o.rolbypassrls or exists (select 1 from pg_class c where c.relowner = o.oid and c.relkind in ('r', 'p')))`);
    expect(rows).toEqual([]);
  });

  async function appendOnlyViolations(tables: string[]): Promise<string[]> {
    const problems: string[] = [];
    for (const table of tables) {
      const { rows } = await pool.query(
        `select has_table_privilege(current_user, $1, 'INSERT') as ins,
                has_table_privilege(current_user, $1, 'SELECT') as sel,
                has_any_column_privilege(current_user, $1, 'UPDATE') as upd,
                has_table_privilege(current_user, $1, 'DELETE') as del,
                has_table_privilege(current_user, $1, 'TRUNCATE') as trunc,
                has_any_column_privilege(current_user, $1, 'REFERENCES') as refs,
                has_table_privilege(current_user, $1, 'TRIGGER') as trig`,
        [`public.${table}`],
      );
      const p = rows[0];
      if (!p.ins || !p.sel || p.upd || p.del || p.trunc || p.refs || p.trig) {
        problems.push(`${table}: ${JSON.stringify(p)}`);
      }
    }
    return problems;
  }

  async function fullRecordViolations(columns: Array<[string, string]>): Promise<string[]> {
    const problems: string[] = [];
    for (const [table, column] of columns) {
      const { rows } = await pool.query(`select has_column_privilege(current_user, $1, $2, 'SELECT') as sel`, [
        `public.${table}`,
        column,
      ]);
      if (rows[0].sel) problems.push(`${table}.${column} is selectable`);
    }
    return problems;
  }

  /** Views, materialized views and SECURITY DEFINER functions the role (default: the connected one) can reach, which RLS and column privileges do not cover. */
  async function securityObjectProblems(db: Pool | PoolClient, role?: string): Promise<string[]> {
    const problems: string[] = [];
    const objects = await db.query<{ name: string; kind: string; invoker: boolean }>(`
      select c.relname as name, c.relkind as kind,
             exists (select 1 from unnest(coalesce(c.reloptions, '{}')) o where o ~ '^security_invoker=(true|on|yes|1|t)$') as invoker
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('v', 'm') order by 1`);
    for (const o of objects.rows) {
      if (o.kind === 'm') problems.push(`materialized view ${o.name} ignores RLS`);
      else if (!o.invoker) problems.push(`view ${o.name} lacks security_invoker=true`);
    }
    const definers = await db.query<{ name: string; pinned: boolean }>(`
      select p.oid::regprocedure::text as name,
             exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') as pinned
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.prosecdef and n.nspname not in ('pg_catalog', 'information_schema')
         and has_schema_privilege(coalesce($1::text, current_user::text), n.oid, 'USAGE')
         and has_function_privilege(coalesce($1::text, current_user::text), p.oid, 'EXECUTE') order by 1`, [role ?? null]);
    for (const d of definers.rows) {
      if (!ALLOWED_DEFINERS.includes(d.name)) problems.push(`unexpected SECURITY DEFINER function ${d.name}`);
      if (!d.pinned) problems.push(`SECURITY DEFINER function ${d.name} does not pin search_path`);
    }
    for (const name of ALLOWED_DEFINERS.filter((a) => !definers.rows.some((d) => d.name === a))) problems.push(`missing SECURITY DEFINER function ${name}`);
    return problems;
  }

  it('has only security_invoker views, no materialized views and only the allowed SECURITY DEFINER functions', async () => {
    expect(await securityObjectProblems(pool)).toEqual([]);
  });

  it('gives the API only INSERT and SELECT on append-only tables', async () => {
    expect(await appendOnlyViolations(APPEND_ONLY)).toEqual([]);
  });

  it('does not let the API select full-record-only columns directly', async () => {
    expect(await fullRecordViolations(FULL_RECORD_COLUMNS)).toEqual([]);
  });

  it('detects UPDATE/DELETE/REFERENCES/TRIGGER privileges on append-only tables', async () => {
    const problems = await appendOnlyViolations(['organisations']);
    expect(problems.length).toBeGreaterThan(0);
  });

  it('detects SELECT privilege on full-record-only columns', async () => {
    const problems = await fullRecordViolations([['organisations', 'name']]);
    expect(problems.length).toBeGreaterThan(0);
  });

  it('detects a view without security_invoker, a materialized view and unlisted or unpinned SECURITY DEFINER functions', async () => {
    // Throwaway objects in public, created by the owner inside a transaction that is always rolled back: nothing is committed,
    // so the parallel catalogue specs never see them.
    const client = await owner.connect();
    try {
      await client.query('begin');
      await client.query('create view public.zz_probe_view as select 1 as n');
      await client.query('create materialized view public.zz_probe_matview as select 1 as n');
      await client.query('create function public.zz_probe_pinned() returns int language sql security definer set search_path = pg_catalog as $$ select 1 $$');
      await client.query('create function public.zz_probe_unpinned() returns int language sql security definer as $$ select 1 $$');
      // An overload of an allowed name is still a new function.
      await client.query('create function public.app_person_contact(text) returns int language sql security definer set search_path = pg_catalog as $$ select 1 $$');
      expect(await securityObjectProblems(client, 'ptw_api')).toEqual([
        'materialized view zz_probe_matview ignores RLS',
        'view zz_probe_view lacks security_invoker=true',
        'unexpected SECURITY DEFINER function app_person_contact(text)',
        'unexpected SECURITY DEFINER function zz_probe_pinned()',
        'unexpected SECURITY DEFINER function zz_probe_unpinned()',
        'SECURITY DEFINER function zz_probe_unpinned() does not pin search_path',
      ]);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});
