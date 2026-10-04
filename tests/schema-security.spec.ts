import { Pool } from 'pg';
import { apiDatabaseUrl } from './helpers/db';

/** Tables the API may only INSERT into and SELECT from (NFR-SEC-001a, FR-AUD-003). Later tasks add to it. */
const APPEND_ONLY: string[] = ['audit_events', 'tenant_data_keys'];

/** Full-record-only columns the API role must not select directly (FR-PRV-005). Later tasks add to it. */
const FULL_RECORD_COLUMNS: [string, string][] = [['people', 'email'], ['people', 'phone']];

// NFR-SEC-001a: "A CI schema test, run as the API role, fails if any application table lacks FORCE RLS
// or a policy, or if the API role is a superuser, has BYPASSRLS or owns a table."
describe('Schema security (NFR-SEC-001a)', () => {
  const pool = new Pool({ connectionString: apiDatabaseUrl });

  afterAll(() => pool.end());

  it('runs as the API role, which is neither a superuser nor able to bypass RLS', async () => {
    const { rows } = await pool.query(
      `select current_user as name, rolsuper as super, rolbypassrls as bypass from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ name: 'ptw_api', super: false, bypass: false });
  });

  it('finds every application table owned by someone else, with ENABLE and FORCE RLS and a policy', async () => {
    const { rows } = await pool.query<{ table: string; owner: string; rls: boolean; forced: boolean; policies: number }>(`
      select c.relname as table, pg_get_userbyid(c.relowner) as owner,
             c.relrowsecurity as rls, c.relforcerowsecurity as forced,
             (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
       order by 1`);
    expect(rows.length).toBeGreaterThan(0);
    const problems = rows.filter((r) => r.owner === 'ptw_api' || !r.rls || !r.forced || r.policies === 0);
    expect(problems).toEqual([]);
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
});
