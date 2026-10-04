import { randomUUID } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { DatabaseModule } from '../app/src/database/database.module';
import { assertRuntimeDatabaseRole } from '../app/src/database/runtime-guard';
import { apiDatabaseUrl, ownerDatabaseUrl, superuserDatabaseUrl } from './helpers/db';

const repoRoot = join(__dirname, '..');

describe('Database roles (NFR-SEC-001a)', () => {
  const api = new Pool({ connectionString: apiDatabaseUrl });
  const owner = new Pool({ connectionString: ownerDatabaseUrl });

  afterAll(async () => {
    await api.end();
    await owner.end();
  });

  it('connects the API as a role that is not a superuser and cannot bypass RLS', async () => {
    const { rows } = await api.query(
      `select current_user as name, rolsuper as super, rolbypassrls as bypass,
              rolcreaterole as createrole, rolcreatedb as createdb
         from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ name: 'ptw_api', super: false, bypass: false, createrole: false, createdb: false });
  });

  it('does not let the API role create tables', async () => {
    await expect(api.query('create table public.api_must_not_create (id int)')).rejects.toMatchObject({ code: '42501' });
  });

  it('runs migrations as a separate owner role that is not a superuser', async () => {
    const { rows } = await owner.query(
      `select current_user as name, rolsuper as super from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ name: 'ptw_owner', super: false });
  });

  it('gives Keycloak its own database, which the API role cannot open', async () => {
    const { rows } = await api.query(
      `select pg_get_userbyid(datdba) as owner from pg_database where datname = 'keycloak'`,
    );
    expect(rows).toEqual([{ owner: 'keycloak' }]);
    const keycloakDb = new Pool({ connectionString: apiDatabaseUrl.replace(/\/ptw_platform$/, '/keycloak') });
    await expect(keycloakDb.query('select 1')).rejects.toMatchObject({ code: '42501' });
    await keycloakDb.end();
  });

  it('refuses to start the API with an owner credential or with a role that can bypass RLS', async () => {
    await expect(assertRuntimeDatabaseRole(api, {})).resolves.toBeUndefined();
    await expect(assertRuntimeDatabaseRole(api, { MIGRATION_DATABASE_URL: ownerDatabaseUrl })).rejects.toThrow('MIGRATION_DATABASE_URL');
    await expect(assertRuntimeDatabaseRole(api, { PTW_OWNER_PASSWORD: 'x' })).rejects.toThrow('PTW_OWNER_PASSWORD');
    await expect(assertRuntimeDatabaseRole(owner, {})).rejects.toThrow('bypass RLS');
  });

  it('starts the API module through the guard: it refuses while an owner credential is in process.env', async () => {
    const module = new DatabaseModule(api);
    const saved = process.env.MIGRATION_DATABASE_URL;
    try {
      process.env.MIGRATION_DATABASE_URL = ownerDatabaseUrl;
      await expect(module.onModuleInit()).rejects.toThrow('MIGRATION_DATABASE_URL');
      delete process.env.MIGRATION_DATABASE_URL;
      await expect(module.onModuleInit()).resolves.toBeUndefined();
    } finally {
      if (saved === undefined) delete process.env.MIGRATION_DATABASE_URL;
      else process.env.MIGRATION_DATABASE_URL = saved;
    }
  });

  it('refuses to start the API when its role owns a table', async () => {
    // Only the bootstrap superuser can hand the API role a table. The probe lives in its own schema, so
    // catalogue specs that scan `public` never see it; it is always dropped.
    const superuser = new Pool({ connectionString: superuserDatabaseUrl });
    try {
      await superuser.query('drop schema if exists guard_probe cascade');
      await superuser.query('create schema guard_probe');
      await superuser.query('create table guard_probe.owned_table (id int)');
      await superuser.query('alter table guard_probe.owned_table owner to ptw_api');
      await expect(assertRuntimeDatabaseRole(api, {})).rejects.toThrow('own tables');
    } finally {
      await superuser.query('drop schema if exists guard_probe cascade');
      await superuser.end();
    }
    await expect(assertRuntimeDatabaseRole(api, {})).resolves.toBeUndefined();
  });

  it('refuses to start the API when its role is a member of a role that bypasses RLS', async () => {
    // Only the bootstrap superuser can make such roles. Both are throwaway, and always dropped.
    const superuser = new Pool({ connectionString: superuserDatabaseUrl });
    const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
    const [bypass, member] = [`guard_bypass_${suffix}`, `guard_member_${suffix}`];
    const password = randomUUID();
    const memberUrl = new URL(superuserDatabaseUrl);
    memberUrl.username = member;
    memberUrl.password = password;
    const memberPool = new Pool({ connectionString: memberUrl.toString() });
    try {
      await superuser.query(`create role ${bypass} nologin bypassrls`);
      await superuser.query(`create role ${member} login password '${password}' in role ${bypass}`);
      await superuser.query(`grant connect on database "${(await superuser.query('select current_database() as name')).rows[0].name}" to ${member}`);
      const own = await superuser.query(`select rolsuper or rolbypassrls as unsafe from pg_roles where rolname = $1`, [member]);
      expect(own.rows[0].unsafe).toBe(false); // clean on its own: only the membership is unsafe
      await expect(assertRuntimeDatabaseRole(memberPool, {})).rejects.toThrow('bypass RLS');
    } finally {
      await memberPool.end();
      for (const role of [member, bypass]) {
        await superuser.query(`drop owned by ${role}`).catch(() => undefined);
        await superuser.query(`drop role if exists ${role}`);
      }
      await superuser.end();
    }
  });

  it('compiles no database credential into API code, so none ships in the API image', () => {
    const credential = /postgres(ql)?:\/\/[^:@/\s'"`]+:[^@\s'"`]+@/;
    const files = readdirSync(join(repoRoot, 'app/src'), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name));
    const found = files.filter((file) => credential.test(readFileSync(file, 'utf8'))).map((file) => file.slice(repoRoot.length + 1));
    expect(found).toEqual([]);
  });

  it('keeps owner credentials out of every compose file', () => {
    const files = readdirSync(repoRoot).filter((name) => /^docker-compose.*\.ya?ml$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    const leaking = files.filter((file) => /MIGRATION_DATABASE_URL|PTW_OWNER_PASSWORD|ptw_owner/.test(readFileSync(join(repoRoot, file), 'utf8')));
    expect(leaking).toEqual([]);
  });
});
