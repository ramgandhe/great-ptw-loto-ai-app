import { ClosureCacheService } from '../src/modules/closure/closure-cache.service';

describe('ClosureCacheService (PUS-150)', () => {
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

  const service = new ClosureCacheService(cacheService as never, configService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('caches archive search results by tenant and query', async () => {
    await service.setSearchResults('tenant-1', { q: 'hot' }, [{ permit: { id: 'p1' } }]);

    expect(setJson).toHaveBeenCalledWith(
      'closure:archive:tenant-1:hot::',
      [{ permit: { id: 'p1' } }],
      300,
    );
  });

  it('invalidates archive detail and search caches for a permit', async () => {
    await service.invalidatePermit('tenant-1', 'permit-1');

    expect(del).toHaveBeenCalledWith('closure:archive:detail:tenant-1:permit-1');
    expect(delByPattern).toHaveBeenCalledWith('closure:archive:tenant-1:*');
  });

  it('invalidates all closure cache keys for a tenant', async () => {
    await service.invalidateTenant('tenant-1');

    expect(delByPattern).toHaveBeenCalledWith('closure:*:tenant-1*');
  });
});
