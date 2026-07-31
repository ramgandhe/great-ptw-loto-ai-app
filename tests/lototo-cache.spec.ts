import { LototoCacheService } from '../app/src/modules/lototo/lototo-cache.service';

describe('LototoCacheService (PUS-155)', () => {
  const del = jest.fn().mockResolvedValue(undefined);
  const delByPattern = jest.fn().mockResolvedValue(undefined);
  const setJson = jest.fn().mockResolvedValue(undefined);

  const cacheService = {
    getJson: jest.fn(),
    setJson,
    del,
    delByPattern,
  };

  const configService = {
    get: jest.fn().mockReturnValue(300),
  };

  const service = new LototoCacheService(cacheService as never, configService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('caches and retrieves plan lists by tenant and permit', async () => {
    await service.setPlanList('tenant-1', 'permit-1', [{ id: 'plan-1' }]);

    expect(setJson).toHaveBeenCalledWith('lototo:list:tenant-1:permit-1', [{ id: 'plan-1' }], 300);
  });

  it('invalidates plan detail and related list caches', async () => {
    await service.invalidatePlan('tenant-1', 'plan-1', 'permit-1');

    expect(del).toHaveBeenCalledWith('lototo:detail:tenant-1:plan-1');
    expect(del).toHaveBeenCalledWith('lototo:list:tenant-1:permit-1');
    expect(del).toHaveBeenCalledWith('lototo:list:tenant-1:all');
  });

  it('invalidates all LOTOTO cache keys for a tenant', async () => {
    await service.invalidateTenant('tenant-1');

    expect(delByPattern).toHaveBeenCalledWith('lototo:*:tenant-1:*');
  });
});
