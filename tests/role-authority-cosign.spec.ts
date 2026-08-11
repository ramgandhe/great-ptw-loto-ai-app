import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../app/src/common/guards/roles.guard';
import { CosignatureService } from '../app/src/modules/execution/cosignature.service';
import { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';

describe('FR-ROL-004 supervisor co-sign (PUS-243)', () => {
  const getAllAndOverride = jest.fn();
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  const buildContext = (user?: { roles: string[] }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows only supervisor role on cosign endpoint', () => {
    getAllAndOverride.mockReturnValue(['supervisor']);

    expect(guard.canActivate(buildContext({ roles: ['supervisor'] }))).toBe(true);
    expect(() => guard.canActivate(buildContext({ roles: ['org-admin'] }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(buildContext({ roles: ['platform-admin'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects non-supervisor at service layer', async () => {
    const service = new CosignatureService(
      {} as never,
      {
        findOne: jest.fn().mockResolvedValue({ permit: { id: 'p1' } }),
      } as never,
      { record: jest.fn() } as never,
      { log: jest.fn() } as never,
    );

    const user = {
      id: 'u1',
      tenantId: 't1',
      roles: ['org-admin'],
    } as AuthenticatedUser;

    await expect(
      service.cosign(
        'p1',
        {
          sourceEntityType: 'permit_progress',
          sourceEntityId: '00000000-0000-4000-8000-000000000099',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
