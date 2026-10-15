import { ConflictException } from '@nestjs/common';
import { PlatformTenantsService } from '../app/src/modules/platform/platform-tenants.service';

describe('PlatformTenantsService', () => {
  it('rejects a second invite for the same owner email', async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: async () => [{ id: 'existing-invite' }],
        }),
      }),
    };
    const service = new PlatformTenantsService(
      db as never,
      {} as never,
      { log: jest.fn() } as never,
      { get: () => 'http://localhost:3000' } as never,
    );

    await expect(
      service.createTenant(
        {
          organisationName: 'Acme',
          ownerEmail: 'owner@acme.test',
          industryId: '00000000-0000-4000-8000-000000000099',
          addressLine1: 'Plot 12',
          state: 'Maharashtra',
          country: 'India',
          pin: '400001',
        },
        { id: 'admin', username: 'admin', roles: ['platform-admin'] },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
