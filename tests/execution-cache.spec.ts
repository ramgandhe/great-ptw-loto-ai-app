import { ExecutionCacheService } from '../app/src/modules/execution/execution-cache.service';

describe('ExecutionCacheService (PUS-145)', () => {
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

  const service = new ExecutionCacheService(cacheService as never, configService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates execution detail and active list caches', async () => {
    await service.invalidatePermit('tenant-1', 'permit-1');

    expect(del).toHaveBeenCalledWith('execution:detail:tenant-1:permit-1');
    expect(del).toHaveBeenCalledWith('execution:active:tenant-1');
  });

  it('invalidates all execution cache keys for a tenant', async () => {
    await service.invalidateTenant('tenant-1');

    expect(delByPattern).toHaveBeenCalledWith('execution:*:tenant-1*');
  });
});
