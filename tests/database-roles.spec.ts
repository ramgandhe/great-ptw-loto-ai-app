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

  it('compiles no database credential into API code, so none ships in the API image', () => {
    const credential = /postgres(ql)?:\/\/[^:@/\s'"`]+:[^@\s'"`]+@/;
    const found: string[] = [];
    const scan = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) scan(path);
        else if (credential.test(readFileSync(path, 'utf8'))) found.push(path.slice(repoRoot.length + 1));
      }
    };
    scan(join(repoRoot, 'app/src'));
    expect(found).toEqual([]);
  });

  it('keeps owner credentials out of every compose file', () => {
    const files = readdirSync(repoRoot).filter((name) => /^docker-compose.*\.ya?ml$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(join(repoRoot, file), 'utf8');
      for (const secret of ['MIGRATION_DATABASE_URL', 'PTW_OWNER_PASSWORD', 'ptw_owner']) {
        expect({ file, secret, present: text.includes(secret) }).toEqual({ file, secret, present: false });
      }
    }
  });
});
