import { BadRequestException } from '@nestjs/common';
import {
  executorKindFor,
  TenantUsersService,
} from '../app/src/modules/workforce/tenant-users.service';

const actor = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'owner',
  roles: ['tenant-owner'],
  tenantId: '22222222-2222-2222-2222-222222222222',
};

function mockDb(existing: unknown[] = []) {
  let fromCount = 0;
  return {
    select: () => ({
      from: () => {
        fromCount += 1;
        const rows = fromCount === 1 ? existing : [];
        return {
          where: async () => rows,
        };
      },
    }),
    insert: () => ({
      values: async () => undefined,
    }),
  };
}

describe('TenantUsersService', () => {
  it('rejects tenant-owner assigning another tenant-owner', async () => {
    const keycloakAdmin = {
      createTenantUser: jest.fn(),
    };
    const service = new TenantUsersService(
      mockDb() as never,
      keycloakAdmin as never,
      { log: jest.fn() } as never,
      { get: () => 'http://localhost:3000' } as never,
    );

    await expect(
      service.create({ name: 'Pat Owner', email: 'owner2@acme.test', role: 'tenant-owner' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(keycloakAdmin.createTenantUser).not.toHaveBeenCalled();
  });

  it('allows platform-admin to assign tenant-owner', async () => {
    const keycloakAdmin = {
      createTenantUser: jest.fn().mockResolvedValue({ id: 'kc-owner', username: 'owner2@acme.test' }),
    };
    const service = new TenantUsersService(
      mockDb() as never,
      keycloakAdmin as never,
      { log: jest.fn() } as never,
      { get: () => 'http://localhost:3000' } as never,
    );

    await service.create(
      { name: 'Pat Owner', email: 'owner2@acme.test', role: 'tenant-owner' },
      { ...actor, roles: ['platform-admin'] },
    );

    expect(keycloakAdmin.createTenantUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'tenant-owner' }),
    );
  });

  it('rejects tenant-admin assigning another tenant-admin', async () => {
    const keycloakAdmin = {
      createTenantUser: jest.fn(),
    };
    const service = new TenantUsersService(
      mockDb() as never,
      keycloakAdmin as never,
      { log: jest.fn() } as never,
      { get: () => 'http://localhost:3000' } as never,
    );

    await expect(
      service.create(
        { name: 'Admin Two', email: 'admin2@acme.test', role: 'tenant-admin' },
        { ...actor, roles: ['tenant-admin'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a tenant user with the actor tenant id', async () => {
    const keycloakAdmin = {
      createTenantUser: jest.fn().mockResolvedValue({ id: 'kc-1', username: 'hod@acme.test' }),
    };
    const service = new TenantUsersService(
      mockDb() as never,
      keycloakAdmin as never,
      { log: jest.fn() } as never,
      { get: () => 'http://localhost:3000' } as never,
    );

    const result = await service.create(
      { name: 'Pat HOD', email: 'hod@acme.test', role: 'hod' },
      actor,
    );

    expect(keycloakAdmin.createTenantUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'hod@acme.test',
        tenantId: actor.tenantId,
        role: 'hod',
        firstName: 'Pat',
        lastName: 'HOD',
      }),
    );
    expect(result.temporaryPassword).toBeTruthy();
    expect(result.email).toBe('hod@acme.test');
  });

  it('lists only active operator accounts as permit executors', async () => {
    const rows = [
      {
        keycloakUserId: 'kc-op',
        email: 'exec@acme.test',
        firstName: 'Exe',
        lastName: 'Cutor',
        role: 'operator',
        status: 'active',
      },
    ];
    const service = new TenantUsersService(
      mockDb(rows) as never,
      {} as never,
      { log: jest.fn() } as never,
      { get: () => 'http://localhost:3000' } as never,
    );

    const result = await service.listExecutors(actor);
    expect(result).toEqual([
      expect.objectContaining({
        id: 'kc-op',
        email: 'exec@acme.test',
        roles: ['operator'],
        executorKind: 'internal',
      }),
    ]);
  });

  it('classifies contractor and agency contacts as external executors', () => {
    expect(executorKindFor('a', new Set(['a']), new Set())).toBe('contractor');
    expect(executorKindFor('a', new Set(), new Set(['a']))).toBe('agency');
    expect(executorKindFor('a', new Set(['a']), new Set(['a']))).toBe('agency');
    expect(executorKindFor('a', new Set(), new Set())).toBe('internal');
  });

  it('reuses an existing tenant login when adding workforce', async () => {
    const existing = [
      {
        keycloakUserId: 'kc-existing',
        email: 'jane@acme.test',
        firstName: 'Jane',
        lastName: 'Op',
        role: 'operator',
        status: 'active',
      },
    ];
    const keycloakAdmin = {
      inspectLoginByEmail: jest.fn(),
      createTenantUser: jest.fn(),
    };
    const service = new TenantUsersService(
      mockDb(existing) as never,
      keycloakAdmin as never,
      { log: jest.fn() } as never,
      { get: () => 'http://localhost:3000' } as never,
    );

    const result = await service.ensureWorkforceLogin(
      { name: 'Jane Op', email: 'jane@acme.test' },
      actor,
    );

    expect(result).toEqual({
      keycloakUserId: 'kc-existing',
      created: false,
      temporaryPassword: null,
    });
    expect(keycloakAdmin.createTenantUser).not.toHaveBeenCalled();
  });
});
